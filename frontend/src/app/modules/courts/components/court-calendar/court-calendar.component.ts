import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CourtService } from '../../../../services/court.service';
import { Court, Reservation, CourtBlock } from '../../../../models/court.model';
import { ToastService } from '../../../../services/toast.service';
import { ConfirmService } from '../../../../services/confirm.service';
import { AuthService } from '../../../../services/auth.service';
import { PaymentService } from '../../../../services/payment.service';
import { environment } from '../../../../../environments/environment';
import { PlayerSelectComponent } from '../../../../components/player-select/player-select.component';
import { PlayerCreateModalComponent } from '../../../../components/player-create-modal/player-create-modal.component';
import { PaymentLinkModalComponent, PaymentLinkData } from '../../../../components/payment-link-modal/payment-link-modal.component';

@Component({
    selector: 'app-court-calendar',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, PlayerSelectComponent, PlayerCreateModalComponent, PaymentLinkModalComponent],
    templateUrl: './court-calendar.component.html',
    styleUrls: ['./court-calendar.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourtCalendarComponent implements OnInit, OnDestroy {
    court: Court | null = null;
    courts: Court[] = [];
    reservations: Reservation[] = [];
    courtBlocks: CourtBlock[] = [];
    loading = true;
    isLoggedIn = false;
    canEdit = false;
    enablePricing = false;

    // Auto-refresh
    private refreshInterval: any = null;
    private readonly REFRESH_MS = 15_000;

    // Accordion sections
    accordionInfo = true;
    accordionPlayers = false;
    accordionPricing = false;

    // Player creation
    @ViewChildren(PlayerSelectComponent) playerSelects!: QueryList<PlayerSelectComponent>;
    showPlayerCreateModal = false;
    playerCreateInitialName = '';
    activePlayerSlotIndex = -1;

    // Calendar state
    weekStart: Date = new Date();
    weekDays: { date: string; label: string; shortDate: string; isToday: boolean }[] = [];
    slots: { label: string; startTime: string; minutes: number }[] = [];
    startHour = 7;
    endHour = 24;

    // Slot filter toggle
    showAllSlots = true;

    // Reservation modal
    showModal = false;
    editingReservation: Reservation | null = null;
    reservationForm = {
        date: '',
        startTime: '08:00',
        endTime: '09:30',
        title: '',
        players: ['', '', '', ''],
        playerCount: 4,
        priceType: 'full_court' as 'full_court' | 'per_player',
        basePrice: 0,
        finalPrice: 0,
        paymentStatus: 'pending' as 'pending' | 'paid' | 'partial',
        paymentMethod: '' as '' | 'cash' | 'transfer' | 'mercado_pago' | 'red_compras',
        paymentNotes: '',
        playerPayments: [] as { playerId?: string; playerName: string; paid: boolean; amount: number; paymentMethod?: string }[]
    };

    timeSlots: string[] = [];
    dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    // Mercado Pago
    mpConfigured = false;
    showPaymentLinkModal = false;
    paymentLinks: PaymentLinkData[] = [];
    paymentLinkLoading = false;
    paymentLinkError = '';

    // Dirty-tracking: snapshot of form when modal opens
    private formSnapshot = '';

    // Last known server-side payment state (deep-cloned, immune to user mutations)
    private _lastServerPaymentSnapshot = '';

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private courtService: CourtService,
        private http: HttpClient,
        private toast: ToastService,
        private confirmService: ConfirmService,
        private authService: AuthService,
        private paymentService: PaymentService,
        private cdr: ChangeDetectorRef
    ) {
        this.buildSlots();
        // Time slots for the start-time dropdown in the modal (always full range)
        for (let t = 7 * 60; t < 24 * 60; t += 30) {
            const hh = Math.floor(t / 60);
            const mm = t % 60;
            this.timeSlots.push(`${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`);
        }
    }

    /** Build visible slot list based on configured price blocks or full range.
     *  When filtering, only slots that overlap with a configured price block are included (gaps allowed). */
    private buildSlots() {
        this.slots = [];

        if (!this.showAllSlots && this.court?.priceBlocks?.length) {
            // For weekly view, union all days-of-week in current week
            const weekDaysOfWeek = this.weekDays.map(wd => new Date(wd.date + 'T12:00:00').getDay());
            const uniqueDays = [...new Set(weekDaysOfWeek)];
            const configuredRanges: { start: number; end: number }[] = [];

            for (const pb of this.court.priceBlocks) {
                if (uniqueDays.some(d => pb.daysOfWeek.includes(d))) {
                    const [sh, sm] = pb.startTime.split(':').map(Number);
                    const [eh, em] = pb.endTime.split(':').map(Number);
                    configuredRanges.push({ start: sh * 60 + sm, end: eh * 60 + em });
                }
            }

            if (configuredRanges.length > 0) {
                const merged = this.mergeRanges(configuredRanges);
                for (const range of merged) {
                    let slotMin = range.start;
                    while (slotMin < range.end) {
                        const h = Math.floor(slotMin / 60);
                        const m = slotMin % 60;
                        const label = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
                        this.slots.push({ label, startTime: label, minutes: slotMin });
                        slotMin += 30;
                    }
                }
                return;
            }
        }

        // Full range: 07:00 – 00:00
        let slotMin = 7 * 60;
        while (slotMin < 24 * 60) {
            const h = Math.floor(slotMin / 60);
            const m = slotMin % 60;
            const label = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            this.slots.push({ label, startTime: label, minutes: slotMin });
            slotMin += 30;
        }
    }

    /** Merge overlapping/adjacent time ranges (in minutes) */
    private mergeRanges(ranges: { start: number; end: number }[]): { start: number; end: number }[] {
        if (!ranges.length) return [];
        const sorted = [...ranges].sort((a, b) => a.start - b.start);
        const merged = [sorted[0]];
        for (let i = 1; i < sorted.length; i++) {
            const last = merged[merged.length - 1];
            if (sorted[i].start <= last.end) {
                last.end = Math.max(last.end, sorted[i].end);
            } else {
                merged.push({ ...sorted[i] });
            }
        }
        return merged;
    }

    /** Map an absolute time string to its pixel position in the (possibly non-continuous) grid.
     *  Each slot is 30px tall (1 min = 1 px within a slot). */
    private timeToGridPx(time: string): number {
        const [h, m] = time.split(':').map(Number);
        const timeMin = h * 60 + m;
        for (let i = 0; i < this.slots.length; i++) {
            const slotStart = this.slots[i].minutes;
            const slotEnd = slotStart + 30;
            if (timeMin >= slotStart && timeMin < slotEnd) {
                return i * 30 + (timeMin - slotStart);
            }
        }
        // Past last slot
        if (this.slots.length > 0) {
            const last = this.slots[this.slots.length - 1];
            if (timeMin >= last.minutes) {
                return (this.slots.length - 1) * 30 + (timeMin - last.minutes);
            }
        }
        return 0;
    }

    /** Toggle between showing all slots or only configured ones */
    toggleSlotFilter() {
        this.showAllSlots = !this.showAllSlots;
        if (this.court?.clubId) {
            localStorage.setItem(`courtView_showAllSlots_${this.court.clubId}`, JSON.stringify(this.showAllSlots));
        }
        this.buildSlots();
        this.cdr.markForCheck();
    }

    ngOnInit() {
        this.isLoggedIn = this.authService.isAuthenticated();
        this.setWeekStart(new Date());

        this.route.params.subscribe(params => {
            const courtId = params['courtId'];
            if (courtId) {
                this.loadCourt(courtId);
            }
        });

        // Start auto-refresh
        this.startAutoRefresh();
    }

    ngOnDestroy() {
        this.stopAutoRefresh();
    }

    private startAutoRefresh() {
        this.stopAutoRefresh();
        this.refreshInterval = setInterval(() => this.silentRefresh(), this.REFRESH_MS);
    }

    private stopAutoRefresh() {
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
            this.refreshInterval = null;
        }
    }

    /** Refresh reservations without showing loading state; sync open modal */
    private silentRefresh() {
        if (!this.court) return;
        const startDate = this.weekDays[0]?.date;
        const endDate = this.weekDays[6]?.date;
        if (!startDate || !endDate) return;
        this.courtService.getReservations(this.court.id, startDate, endDate).subscribe({
            next: (res) => {
                this.reservations = res;
                // If a reservation modal is open, always sync payment data from server
                if (this.showModal && this.editingReservation) {
                    const updated = res.find(r => r.id === this.editingReservation!.id);
                    if (updated) {
                        this.syncModalPaymentData(updated);
                    } else {
                        // Reservation was deleted externally
                        this.showModal = false;
                        this.toast.info('La reserva fue eliminada');
                    }
                }
                this.cdr.markForCheck();
            },
            error: () => {} // silent
        });
    }

    /** Sync payment-related fields from a refreshed reservation into the open modal form.
     *  Only updates when the SERVER data actually changed – never overwrites user edits. */
    private syncModalPaymentData(updated: Reservation) {
        // Build a snapshot of the NEW server payment state
        const newServerSnapshot = JSON.stringify({
            paymentStatus: updated.paymentStatus || 'pending',
            paymentMethod: (updated as any).paymentMethod || '',
            playerPayments: updated.playerPayments || [],
        });

        // Compare against last known server state (immune to user mutations)
        if (newServerSnapshot === this._lastServerPaymentSnapshot) {
            return; // Server hasn't changed → don't touch the form
        }

        // Extract previous server status before updating
        const prevStatus = JSON.parse(this._lastServerPaymentSnapshot || '{}').paymentStatus || 'pending';

        // Server has genuinely changed → update only payment fields
        this.reservationForm.paymentStatus = updated.paymentStatus || 'pending';
        this.reservationForm.paymentMethod = (updated as any).paymentMethod || '';
        if (updated.playerPayments?.length) {
            this.reservationForm.playerPayments = JSON.parse(JSON.stringify(updated.playerPayments));
        }
        if (updated.paymentNotes !== undefined) {
            this.reservationForm.paymentNotes = updated.paymentNotes || '';
        }

        // Update server snapshot
        this._lastServerPaymentSnapshot = newServerSnapshot;

        // Update the editingReservation reference
        this.editingReservation = updated;

        // Re-take form snapshot so these server changes don't make the form look "dirty"
        this.formSnapshot = JSON.stringify(this.reservationForm);

        const newStatus = updated.paymentStatus || 'pending';
        if (prevStatus !== newStatus && newStatus !== 'pending') {
            const label = newStatus === 'paid' ? 'completamente pagada' : 'parcialmente pagada';
            this.toast.success(`Reserva ${label}`);
        }
    }

    /** After a successful save, align both snapshots with the current form state */
    private _syncSnapshotsAfterSave() {
        this.formSnapshot = JSON.stringify(this.reservationForm);
        this._lastServerPaymentSnapshot = JSON.stringify({
            paymentStatus: this.reservationForm.paymentStatus,
            paymentMethod: this.reservationForm.paymentMethod,
            playerPayments: this.reservationForm.playerPayments,
        });
    }

    // ── Week helpers ─────────────────────────────────────────

    setWeekStart(date: Date) {
        const d = new Date(date);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        d.setDate(diff);
        d.setHours(0, 0, 0, 0);
        this.weekStart = d;
        this.buildWeekDays();
        this.buildSlots(); // week change may affect configured slots by day-of-week
    }

    buildWeekDays() {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        this.weekDays = [];
        for (let i = 0; i < 7; i++) {
            const d = new Date(this.weekStart);
            d.setDate(d.getDate() + i);
            this.weekDays.push({
                date: this.fmtDate(d),
                label: this.dayLabels[i],
                shortDate: `${d.getDate()}/${d.getMonth() + 1}`,
                isToday: d.getTime() === today.getTime()
            });
        }
    }

    fmtDate(d: Date): string {
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    get weekLabel(): string {
        const end = new Date(this.weekStart);
        end.setDate(end.getDate() + 6);
        const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
        return `${this.weekStart.getDate()} ${months[this.weekStart.getMonth()]} – ${end.getDate()} ${months[end.getMonth()]} ${end.getFullYear()}`;
    }

    prevWeek() {
        const d = new Date(this.weekStart);
        d.setDate(d.getDate() - 7);
        this.setWeekStart(d);
        this.loadReservations();
    }

    nextWeek() {
        const d = new Date(this.weekStart);
        d.setDate(d.getDate() + 7);
        this.setWeekStart(d);
        this.loadReservations();
    }

    goToday() {
        this.setWeekStart(new Date());
        this.loadReservations();
    }

    // ── Data loading ─────────────────────────────────────────

    loadCourt(courtId: string) {
        this.loading = true;
        this.courtService.getCourt(courtId).subscribe({
            next: (court) => {
                this.court = court;

                // Restore slot filter preference for this club
                const saved = localStorage.getItem(`courtView_showAllSlots_${court.clubId}`);
                if (saved !== null) {
                    this.showAllSlots = JSON.parse(saved);
                }
                this.buildSlots();

                // Check club pricing
                this.http.get<any>(`${environment.apiUrl}/clubs/${court.clubId}`).subscribe({
                    next: (club) => {
                        this.enablePricing = club.enableCourtPricing || false;
                        this.cdr.markForCheck();
                    }
                });

                // Check role
                this.canEdit = this.authService.hasClubRole(court.clubId, 'editor');

                // Check MP config
                this.paymentService.getConfig().subscribe({
                    next: (cfg) => {
                        this.mpConfigured = cfg.configured;
                        this.cdr.markForCheck();
                    },
                    error: () => { this.mpConfigured = false; }
                });

                // Load sibling courts for tabs
                this.courtService.getCourtsByClub(court.clubId).subscribe({
                    next: (courts) => {
                        this.courts = courts.filter(c => c.isActive);
                        this.cdr.markForCheck();
                    }
                });

                this.loadReservations();
            },
            error: () => {
                this.loading = false;
                this.toast.error('Error al cargar cancha');
                this.cdr.markForCheck();
            }
        });
    }

    loadReservations() {
        if (!this.court) return;
        const startDate = this.weekDays[0].date;
        const endDate = this.weekDays[6].date;
        this.courtService.getReservations(this.court.id, startDate, endDate).subscribe({
            next: (res) => {
                this.reservations = res;
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: () => {
                this.loading = false;
                this.toast.error('Error al cargar reservas');
                this.cdr.markForCheck();
            }
        });
        // Load blocks
        this.courtService.getCourtBlocks(this.court.clubId).subscribe({
            next: (blocks) => {
                this.courtBlocks = blocks.filter(b => b.isActive);
                this.cdr.markForCheck();
            },
            error: () => {}
        });
    }

    switchCourt(courtId: string) {
        this.router.navigate(['/courts', courtId, 'calendar']);
    }

    // ── Grid helpers ─────────────────────────────────────────

    getReservationsForDay(date: string): Reservation[] {
        return this.reservations.filter(r => r.date === date);
    }

    getReservationTop(res: Reservation): string {
        return this.timeToGridPx(res.startTime) + 'px';
    }

    getReservationHeight(res: Reservation): string {
        const height = this.timeToGridPx(res.endTime) - this.timeToGridPx(res.startTime);
        return Math.max(height, 20) + 'px';
    }

    getReservationColor(res: Reservation): string {
        if (res.status === 'cancelled') return '#6b7280';
        if (res.paymentStatus === 'paid') return 'var(--success, #10b981)';
        if (res.paymentStatus === 'partial') return '#f59e0b';
        return '#ef4444';
    }

    // ── Block overlay helpers ────────────────────────────────

    private blockTimeRange(block: CourtBlock): { start: string; end: string } {
        switch (block.blockType) {
            case 'morning': return { start: '07:00', end: '12:00' };
            case 'afternoon': return { start: '12:00', end: '18:00' };
            case 'night': return { start: '18:00', end: '23:30' };
            case 'full_day': return { start: '07:00', end: '23:30' };
            case 'custom': return { start: block.customStartTime || '07:00', end: block.customEndTime || '23:30' };
            default: return { start: '07:00', end: '23:30' };
        }
    }

    getBlocksForDay(date: string): { top: string; height: string; reason: string }[] {
        if (!this.court) return [];
        const result: { top: string; height: string; reason: string }[] = [];
        for (const block of this.courtBlocks) {
            if (block.startDate > date || block.endDate < date) continue;
            if (block.courtIds && !block.courtIds.includes(this.court.id)) continue;
            const { start, end } = this.blockTimeRange(block);
            const topPx = Math.max(0, this.timeToGridPx(start));
            const heightPx = Math.max(20, this.timeToGridPx(end) - this.timeToGridPx(start));
            result.push({ top: topPx + 'px', height: heightPx + 'px', reason: block.reason || 'Bloqueado' });
        }
        return result;
    }

    isSlotBlocked(date: string, startTime: string): boolean {
        if (!this.court) return false;
        const sMin = this.parseTimeMin(startTime);
        const endMin = sMin + 30;
        const endTime = `${Math.floor(endMin / 60).toString().padStart(2, '0')}:${(endMin % 60).toString().padStart(2, '0')}`;
        for (const block of this.courtBlocks) {
            if (block.startDate > date || block.endDate < date) continue;
            if (block.courtIds && !block.courtIds.includes(this.court.id)) continue;
            const { start, end } = this.blockTimeRange(block);
            if (startTime < end && endTime > start) return true;
        }
        return false;
    }

    private parseTimeMin(time: string): number {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    }

    // ── Reservation CRUD ─────────────────────────────────────

    openCreateModal(date: string, slotStartTime: string) {
        if (!this.isLoggedIn || !this.court) return;
        if (this.isSlotBlocked(date, slotStartTime)) {
            this.toast.error('Este horario está bloqueado');
            return;
        }
        this.editingReservation = null;

        const startTime = slotStartTime;
        const endTime = this.calcEndTime(startTime);

        this.reservationForm = {
            date,
            startTime,
            endTime,
            title: '',
            players: ['', '', '', ''],
            playerCount: 4,
            priceType: 'full_court',
            basePrice: 0,
            finalPrice: 0,
            paymentStatus: 'pending',
            paymentMethod: '',
            paymentNotes: '',
            playerPayments: []
        };

        this.calculatePrice();
        this.formSnapshot = ''; // new reservation → no snapshot
        this.showModal = true;
        this.cdr.markForCheck();
    }

    openEditModal(res: Reservation) {
        if (!this.isLoggedIn) return;
        this.editingReservation = res;
        const players = [...(res.players || [])];
        while (players.length < 4) players.push('');

        this.reservationForm = {
            date: res.date,
            startTime: res.startTime,
            endTime: res.endTime,
            title: res.title || '',
            players,
            playerCount: res.playerCount || 4,
            priceType: res.priceType || 'full_court',
            basePrice: Number(res.basePrice) || 0,
            finalPrice: Number(res.finalPrice) || 0,
            paymentStatus: res.paymentStatus || 'pending',
            paymentMethod: (res as any).paymentMethod || '',
            paymentNotes: res.paymentNotes || '',
            playerPayments: JSON.parse(JSON.stringify(res.playerPayments || []))
        };

        this.showModal = true;
        // Take a snapshot AFTER populating the form so we can detect changes
        this.formSnapshot = JSON.stringify(this.reservationForm);
        // Store server payment state independently
        this._lastServerPaymentSnapshot = JSON.stringify({
            paymentStatus: res.paymentStatus || 'pending',
            paymentMethod: (res as any).paymentMethod || '',
            playerPayments: res.playerPayments || [],
        });
        this.cdr.markForCheck();
    }

    calcEndTime(start: string): string {
        const [h, m] = start.split(':').map(Number);
        let endMin = m + 30;
        let endH = h + 1;
        if (endMin >= 60) { endMin -= 60; endH++; }
        const maxMin = 23 * 60 + 30;
        if (endH * 60 + endMin > maxMin) {
            endH = 23; endMin = 30;
        }
        return `${endH.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
    }

    isTimeSlotPast(time: string): boolean {
        const today = new Date();
        const yyyy = today.getFullYear();
        const mm = String(today.getMonth() + 1).padStart(2, '0');
        const dd = String(today.getDate()).padStart(2, '0');
        const todayStr = `${yyyy}-${mm}-${dd}`;
        if (this.reservationForm.date !== todayStr) return false;
        const [h, m] = time.split(':').map(Number);
        const slotMinutes = h * 60 + m;
        const nowMinutes = today.getHours() * 60 + today.getMinutes();
        return slotMinutes <= nowMinutes;
    }

    onStartTimeChange() {
        this.reservationForm.endTime = this.calcEndTime(this.reservationForm.startTime);
        this.calculatePrice();
    }

    calculatePrice() {
        if (!this.court || !this.enablePricing) return;

        if (this.court.priceBlocks?.length) {
            const date = this.reservationForm.date;
            const startTime = this.reservationForm.startTime;
            const dayOfWeek = new Date(date + 'T12:00:00').getDay();

            const block = this.court.priceBlocks.find(b =>
                b.daysOfWeek.includes(dayOfWeek) &&
                b.startTime <= startTime &&
                b.endTime > startTime
            );

            if (block) {
                this.reservationForm.basePrice = Number(block.priceFullCourt);
                if (this.reservationForm.priceType === 'per_player') {
                    // In per-player mode, finalPrice comes from sum of individual amounts
                    this.updateOverallPaymentStatus();
                } else if (!this.editingReservation) {
                    this.reservationForm.finalPrice = Number(block.priceFullCourt);
                }
            } else {
                this.reservationForm.basePrice = 0;
                if (!this.editingReservation) {
                    this.reservationForm.finalPrice = 0;
                }
            }
            this.cdr.markForCheck();
        }
    }

    onPriceTypeChange() {
        if (this.reservationForm.priceType === 'per_player') {
            this.initPlayerPayments();
        } else {
            this.reservationForm.playerPayments = [];
        }
        this.calculatePrice();
    }

    onPlayerCountChange() {
        const count = this.reservationForm.playerCount;
        const current = this.reservationForm.players;
        if (current.length < count) {
            while (this.reservationForm.players.length < count) {
                this.reservationForm.players.push('');
            }
        } else if (current.length > count) {
            this.reservationForm.players = current.slice(0, count);
        }
        this.onPlayerChange();
        this.cdr.markForCheck();
    }

    saveReservation() {
        if (!this.court) return;
        if (!this.editingReservation && this.isTimeSlotPast(this.reservationForm.startTime)) {
            this.toast.error('No se puede reservar un horario que ya pasó');
            return;
        }
        const players = this.reservationForm.players.filter(p => p.trim());
        const data: any = {
            courtId: this.court.id,
            clubId: this.court.clubId,
            date: this.reservationForm.date,
            startTime: this.reservationForm.startTime,
            endTime: this.reservationForm.endTime,
            title: this.reservationForm.title || undefined,
            players,
            playerCount: this.reservationForm.playerCount,
            priceType: this.reservationForm.priceType,
            finalPrice: this.reservationForm.finalPrice,
            paymentStatus: this.reservationForm.paymentStatus,
            paymentMethod: this.reservationForm.paymentMethod || undefined,
            paymentNotes: this.reservationForm.paymentNotes || undefined,
            playerPayments: this.reservationForm.priceType === 'per_player' ? this.reservationForm.playerPayments : null
        };

        if (this.editingReservation) {
            this.courtService.updateReservation(this.editingReservation.id, data).subscribe({
                next: () => {
                    this.showModal = false;
                    this.loadReservations();
                    this.toast.success('Reserva actualizada');
                },
                error: (err) => this.toast.error(err.error?.message || 'Error al actualizar reserva')
            });
        } else {
            this.courtService.createReservation(data).subscribe({
                next: () => {
                    this.showModal = false;
                    this.loadReservations();
                    this.toast.success('Reserva creada');
                },
                error: (err) => this.toast.error(err.error?.message || 'Error al crear reserva')
            });
        }
    }

    async cancelReservation() {
        if (!this.editingReservation) return;
        const ok = await this.confirmService.confirm({
            title: 'Cancelar Reserva',
            message: '¿Cancelar esta reserva?',
            confirmText: 'Cancelar Reserva',
            confirmClass: 'btn-warning'
        });
        if (!ok) return;
        this.courtService.cancelReservation(this.editingReservation.id).subscribe({
            next: () => {
                this.showModal = false;
                this.loadReservations();
                this.toast.success('Reserva cancelada');
            },
            error: () => this.toast.error('Error al cancelar reserva')
        });
    }

    // ── Player creation ─────────────────────────────────────────

    onRequestCreatePlayer(name: string, slotIndex: number) {
        this.playerCreateInitialName = name;
        this.activePlayerSlotIndex = slotIndex;
        this.showPlayerCreateModal = true;
        this.cdr.markForCheck();
    }

    onPlayerCreated(player: any) {
        // Put the created player name into the active slot
        if (this.activePlayerSlotIndex >= 0 && this.activePlayerSlotIndex < this.reservationForm.players.length) {
            this.reservationForm.players[this.activePlayerSlotIndex] = player.name;
        }
        // Reload the player lists in all selects
        this.playerSelects.forEach(ps => {
            ps.loadPlayers();
        });
        this.showPlayerCreateModal = false;
        this.cdr.markForCheck();
    }

    onClosePlayerCreateModal() {
        this.showPlayerCreateModal = false;
        this.cdr.markForCheck();
    }

    getExcludedPlayerNames(slotIndex: number): string[] {
        return this.reservationForm.players.filter((p, i) => i !== slotIndex && p.trim());
    }

    // ── Helpers ───────────────────────────────────────────────

    trackByIndex(index: number): number {
        return index;
    }

    formatPrice(price: number): string {
        if (!price) return '0$';
        return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(price) + '$';
    }

    // ── Per-player payment helpers ───────────────────────────

    get allPlayersFilled(): boolean {
        return this.reservationForm.players.filter(p => p.trim()).length >= 4;
    }

    /** True when at least one player in the per-player grid has paid */
    get hasAnyPlayerPaid(): boolean {
        return this.reservationForm.playerPayments.some(pp => pp.paid);
    }

    /** True when the reservation payment is fully completed */
    get isFullyPaid(): boolean {
        return this.reservationForm.paymentStatus === 'paid';
    }

    /** True if the form differs from the snapshot taken when the modal opened */
    get hasFormChanged(): boolean {
        if (!this.formSnapshot) return true; // new reservation → always allow save
        return JSON.stringify(this.reservationForm) !== this.formSnapshot;
    }

    /** Get the player ID from the player-select component at the given index */
    private getPlayerIdForIndex(index: number): string | null {
        const selects = this.playerSelects?.toArray();
        return selects?.[index]?.selectedPlayerId || null;
    }

    /** Check if a specific player (by index) has already paid */
    isPlayerPaid(index: number): boolean {
        const pp = this.reservationForm.playerPayments;
        if (!pp || !pp.length) return false;
        // Match by playerId first, then fall back to playerName
        const playerId = this.getPlayerIdForIndex(index);
        if (playerId) {
            return pp.some(p => p.playerId === playerId && p.paid);
        }
        const playerName = this.reservationForm.players[index]?.trim();
        if (!playerName) return false;
        return pp.some(p => p.playerName === playerName && p.paid);
    }

    onPlayerChange() {
        if (this.reservationForm.priceType === 'per_player' && !this.allPlayersFilled) {
            this.reservationForm.priceType = 'full_court';
            this.reservationForm.playerPayments = [];
            this.calculatePrice();
        }
        if (this.reservationForm.priceType === 'per_player' && this.allPlayersFilled) {
            this.initPlayerPayments();
        }
        this.cdr.markForCheck();
    }

    initPlayerPayments() {
        const filledPlayers = this.reservationForm.players.filter(p => p.trim());
        const perPlayerAmount = Math.round(((this.reservationForm.basePrice || 0) / 4) * 100) / 100;
        const existing = this.reservationForm.playerPayments || [];
        const selects = this.playerSelects?.toArray() || [];

        this.reservationForm.playerPayments = filledPlayers.map((name, idx) => {
            const playerId = selects[idx]?.selectedPlayerId || undefined;
            // Match existing entry by playerId first, then by name
            const prev = existing.find(pp => (playerId && pp.playerId === playerId) || pp.playerName === name);
            return prev
                ? { ...prev, playerId: playerId || prev.playerId, playerName: name, amount: prev.amount || perPlayerAmount }
                : { playerId, playerName: name, paid: false, amount: perPlayerAmount, paymentMethod: undefined };
        });
        this.updateOverallPaymentStatus();
    }

    /** Called when the per-player toggle is clicked (Pendiente → Pagado) */
    onPlayerPaidToggle(pp: any) {
        pp.paid = true;
        if (!pp.paymentMethod) {
            pp.paymentMethod = 'cash'; // default to cash for manual admin toggle
        }
        this.updateOverallPaymentStatus();
    }

    updateOverallPaymentStatus() {
        const pp = this.reservationForm.playerPayments;
        if (!pp.length) return;
        const allPaid = pp.every(p => p.paid);
        const somePaid = pp.some(p => p.paid);
        this.reservationForm.paymentStatus = allPaid ? 'paid' : somePaid ? 'partial' : 'pending';
        this.reservationForm.finalPrice = pp.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
        this.cdr.markForCheck();
    }

    // ── Mercado Pago payment links ──────────────────────────

    generatePaymentLink() {
        if (!this.court) return;
        this.paymentLinkLoading = true;
        this.paymentLinkError = '';
        this.paymentLinks = [];
        this.showPaymentLinkModal = true;
        this.cdr.markForCheck();

        const players = this.reservationForm.players.filter(p => p.trim());
        const data: any = {
            courtId: this.court.id,
            clubId: this.court.clubId,
            date: this.reservationForm.date,
            startTime: this.reservationForm.startTime,
            endTime: this.reservationForm.endTime,
            title: this.reservationForm.title || undefined,
            players,
            playerCount: this.reservationForm.playerCount,
            priceType: this.reservationForm.priceType,
            finalPrice: this.reservationForm.finalPrice,
            paymentStatus: this.reservationForm.paymentStatus,
            paymentMethod: this.reservationForm.paymentMethod || undefined,
            paymentNotes: this.reservationForm.paymentNotes || undefined,
            playerPayments: this.reservationForm.priceType === 'per_player' ? this.reservationForm.playerPayments : null
        };

        if (this.editingReservation) {
            // Update existing reservation to sync data, then generate links
            this.courtService.updateReservation(this.editingReservation.id, data).subscribe({
                next: () => {
                    // Re-snapshot so auto-refresh can detect future payment changes
                    this._syncSnapshotsAfterSave();
                    this.doGeneratePaymentLinks(this.editingReservation!.id);
                },
                error: (err) => {
                    this.paymentLinkLoading = false;
                    this.paymentLinkError = err.error?.message || 'Error al guardar reserva';
                    this.cdr.markForCheck();
                }
            });
        } else {
            this.courtService.createReservation(data).subscribe({
                next: (res: any) => {
                    this.editingReservation = res;
                    this.loadReservations();
                    this.toast.success('Reserva creada');
                    this.doGeneratePaymentLinks(res.id);
                },
                error: (err) => {
                    this.paymentLinkLoading = false;
                    this.paymentLinkError = err.error?.message || 'Error al guardar reserva';
                    this.cdr.markForCheck();
                }
            });
        }
    }

    private doGeneratePaymentLinks(reservationId: string) {
        if (this.reservationForm.priceType === 'per_player' && this.reservationForm.playerPayments.length > 0) {
            this.paymentService.createPerPlayerLinks(reservationId).subscribe({
                next: (result) => {
                    this.paymentLinks = result.links.map(l => ({
                        playerName: l.playerName,
                        amount: l.amount,
                        paymentUrl: l.paymentUrl,
                        shortUrl: l.shortUrl,
                        status: l.status,
                    }));
                    this.paymentLinkLoading = false;
                    this.cdr.markForCheck();
                },
                error: (err) => {
                    this.paymentLinkError = err.error?.message || 'Error al generar links';
                    this.paymentLinkLoading = false;
                    this.cdr.markForCheck();
                }
            });
        } else {
            this.paymentService.createPaymentLink(reservationId).subscribe({
                next: (result) => {
                    this.paymentLinks = [{
                        paymentUrl: result.paymentUrl,
                        shortUrl: result.shortUrl,
                        amount: this.reservationForm.finalPrice,
                        status: 'pending',
                    }];
                    this.paymentLinkLoading = false;
                    this.cdr.markForCheck();
                },
                error: (err) => {
                    this.paymentLinkError = err.error?.message || 'Error al generar link';
                    this.paymentLinkLoading = false;
                    this.cdr.markForCheck();
                }
            });
        }
    }

    // ── Per-player link on demand ───────────────────────────

    generatePlayerLink(playerIndex: number) {
        if (!this.court) return;
        const playerName = this.reservationForm.players[playerIndex];
        if (!playerName || !playerName.trim()) {
            this.toast.error('El jugador no tiene nombre');
            return;
        }
        this.showPaymentLinkModal = true;
        this.paymentLinks = [];
        this.paymentLinkLoading = true;
        this.paymentLinkError = '';
        this.cdr.markForCheck();

        const players = this.reservationForm.players.filter(p => p.trim());
        const data: any = {
            courtId: this.court.id, clubId: this.court.clubId,
            date: this.reservationForm.date, startTime: this.reservationForm.startTime,
            endTime: this.reservationForm.endTime, title: this.reservationForm.title || undefined,
            players, playerCount: this.reservationForm.playerCount,
            priceType: this.reservationForm.priceType, finalPrice: this.reservationForm.finalPrice,
            paymentStatus: this.reservationForm.paymentStatus,
            paymentMethod: this.reservationForm.paymentMethod || undefined,
            paymentNotes: this.reservationForm.paymentNotes || undefined,
            playerPayments: this.reservationForm.priceType === 'per_player' ? this.reservationForm.playerPayments : null
        };

        if (this.editingReservation) {
            this.courtService.updateReservation(this.editingReservation.id, data).subscribe({
                next: () => {
                    // Re-snapshot so auto-refresh can detect future payment changes
                    this._syncSnapshotsAfterSave();
                    this.doGenerateSinglePlayerLink(this.editingReservation!.id, playerIndex);
                },
                error: (err) => {
                    this.paymentLinkError = err.error?.message || 'Error al guardar reserva';
                    this.paymentLinkLoading = false;
                    this.cdr.markForCheck();
                }
            });
        } else {
            this.courtService.createReservation(data).subscribe({
                next: (res: any) => {
                    this.editingReservation = res;
                    this.loadReservations();
                    this.toast.success('Reserva creada');
                    this.doGenerateSinglePlayerLink(res.id, playerIndex);
                },
                error: (err) => {
                    this.paymentLinkError = err.error?.message || 'Error al crear reserva';
                    this.paymentLinkLoading = false;
                    this.cdr.markForCheck();
                }
            });
        }
    }

    private doGenerateSinglePlayerLink(reservationId: string, playerIndex: number) {
        this.paymentService.createSinglePlayerLink(reservationId, playerIndex).subscribe({
            next: (result) => {
                this.paymentLinks = [{
                    playerName: result.playerName,
                    amount: result.amount,
                    paymentUrl: result.paymentUrl,
                    shortUrl: result.shortUrl,
                    status: result.status,
                }];
                this.paymentLinkLoading = false;
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.paymentLinkError = err.error?.message || 'Error al generar link';
                this.paymentLinkLoading = false;
                this.cdr.markForCheck();
            }
        });
    }
}
