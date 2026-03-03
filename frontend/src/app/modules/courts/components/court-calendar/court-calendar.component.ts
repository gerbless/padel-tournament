import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CourtService } from '../../../../services/court.service';
import { Court, Reservation } from '../../../../models/court.model';
import { ToastService } from '../../../../services/toast.service';
import { ConfirmService } from '../../../../services/confirm.service';
import { AuthService } from '../../../../services/auth.service';
import { environment } from '../../../../../environments/environment';
import { PlayerSelectComponent } from '../../../../components/player-select/player-select.component';
import { PlayerCreateModalComponent } from '../../../../components/player-create-modal/player-create-modal.component';

@Component({
    selector: 'app-court-calendar',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, PlayerSelectComponent, PlayerCreateModalComponent],
    templateUrl: './court-calendar.component.html',
    styleUrls: ['./court-calendar.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourtCalendarComponent implements OnInit {
    court: Court | null = null;
    courts: Court[] = [];
    reservations: Reservation[] = [];
    loading = true;
    isLoggedIn = false;
    enablePricing = false;

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
        paymentNotes: '',
        playerPayments: [] as { playerName: string; paid: boolean; amount: number }[]
    };

    timeSlots: string[] = [];
    dayLabels = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private courtService: CourtService,
        private http: HttpClient,
        private toast: ToastService,
        private confirmService: ConfirmService,
        private authService: AuthService,
        private cdr: ChangeDetectorRef
    ) {
        // Generate 30-min slots from 7:00 to 23:00 (last slot ends at 23:30)
        let slotMin = this.startHour * 60;
        const endMin = 23 * 60 + 30;
        while (slotMin < endMin) {
            const h = Math.floor(slotMin / 60);
            const m = slotMin % 60;
            const label = `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
            this.slots.push({ label, startTime: label, minutes: slotMin });
            slotMin += 30;
        }
        // Time slots for the start-time dropdown in the modal
        for (let t = this.startHour * 60; t < endMin; t += 30) {
            const hh = Math.floor(t / 60);
            const mm = t % 60;
            this.timeSlots.push(`${hh.toString().padStart(2, '0')}:${mm.toString().padStart(2, '0')}`);
        }
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

                // Check club pricing
                this.http.get<any>(`${environment.apiUrl}/clubs/${court.clubId}`).subscribe({
                    next: (club) => {
                        this.enablePricing = club.enableCourtPricing || false;
                        this.cdr.markForCheck();
                    }
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
    }

    switchCourt(courtId: string) {
        this.router.navigate(['/courts', courtId, 'calendar']);
    }

    // ── Grid helpers ─────────────────────────────────────────

    getReservationsForDay(date: string): Reservation[] {
        return this.reservations.filter(r => r.date === date);
    }

    getReservationTop(res: Reservation): string {
        const [h, m] = res.startTime.split(':').map(Number);
        return ((h - this.startHour) * 60 + m) + 'px';
    }

    getReservationHeight(res: Reservation): string {
        const [sh, sm] = res.startTime.split(':').map(Number);
        const [eh, em] = res.endTime.split(':').map(Number);
        const dur = (eh * 60 + em) - (sh * 60 + sm);
        return Math.max(dur, 20) + 'px';
    }

    getReservationColor(res: Reservation): string {
        if (res.status === 'cancelled') return '#6b7280';
        if (res.paymentStatus === 'paid') return 'var(--success, #10b981)';
        if (res.paymentStatus === 'partial') return '#f59e0b';
        return '#ef4444';
    }

    // ── Reservation CRUD ─────────────────────────────────────

    openCreateModal(date: string, slotStartTime: string) {
        if (!this.isLoggedIn || !this.court) return;
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
            paymentNotes: '',
            playerPayments: []
        };

        this.calculatePrice();
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
            paymentNotes: res.paymentNotes || '',
            playerPayments: res.playerPayments || []
        };

        this.showModal = true;
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

    saveReservation() {
        if (!this.court) return;
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

        this.reservationForm.playerPayments = filledPlayers.map(name => {
            const prev = existing.find(pp => pp.playerName === name);
            return prev ? { ...prev, amount: prev.amount || perPlayerAmount } : { playerName: name, paid: false, amount: perPlayerAmount };
        });
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
}
