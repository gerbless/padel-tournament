import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { CourtService } from '../../../../services/court.service';
import { Court, Reservation } from '../../../../models/court.model';
import { ToastService } from '../../../../services/toast.service';
import { AuthService } from '../../../../services/auth.service';
import { environment } from '../../../../../environments/environment';
import { PlayerSelectComponent } from '../../../../components/player-select/player-select.component';
import { PlayerCreateModalComponent } from '../../../../components/player-create-modal/player-create-modal.component';

@Component({
    selector: 'app-court-daily-view',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink, PlayerSelectComponent, PlayerCreateModalComponent],
    templateUrl: './court-daily-view.component.html',
    styleUrls: ['./court-daily-view.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourtDailyViewComponent implements OnInit {
    clubId = '';
    clubName = '';
    courts: Court[] = [];
    reservations: Reservation[] = [];
    loading = true;
    isLoggedIn = false;
    canEdit = false;
    enablePricing = false;

    // Current day
    currentDate: Date = new Date();
    dateStr = '';

    // Time grid
    hours: number[] = [];
    startHour = 7;
    endHour = 23;
    timeSlots: string[] = [];

    // Reservation modal
    showModal = false;
    editingReservation: Reservation | null = null;
    selectedCourtId = '';
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
        paymentNotes: ''
    };

    noPriceBlockMessage = '';

    // Player creation
    @ViewChildren(PlayerSelectComponent) playerSelects!: QueryList<PlayerSelectComponent>;
    showPlayerCreateModal = false;
    playerCreateInitialName = '';
    activePlayerSlotIndex = -1;

    dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private courtService: CourtService,
        private http: HttpClient,
        private toast: ToastService,
        private authService: AuthService,
        private cdr: ChangeDetectorRef
    ) {
        for (let h = this.startHour; h < this.endHour; h++) {
            this.hours.push(h);
        }
        for (let h = this.startHour; h <= this.endHour; h++) {
            this.timeSlots.push(`${h.toString().padStart(2, '0')}:00`);
            if (h < this.endHour) {
                this.timeSlots.push(`${h.toString().padStart(2, '0')}:30`);
            }
        }
    }

    ngOnInit() {
        this.isLoggedIn = this.authService.isAuthenticated();
        this.setDate(new Date());

        this.route.queryParams.subscribe(params => {
            this.clubId = params['clubId'] || '';
            if (this.clubId) {
                this.canEdit = this.authService.hasClubRole(this.clubId, 'editor');
                this.loadClub();
                this.loadCourts();
            }
        });
    }

    // ── Date helpers ─────────────────────────────────────────

    setDate(date: Date) {
        this.currentDate = new Date(date);
        this.currentDate.setHours(0, 0, 0, 0);
        this.dateStr = this.fmtDate(this.currentDate);
    }

    fmtDate(d: Date): string {
        const y = d.getFullYear();
        const m = (d.getMonth() + 1).toString().padStart(2, '0');
        const day = d.getDate().toString().padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    get dateLabel(): string {
        const dn = this.dayNames[this.currentDate.getDay()];
        const day = this.currentDate.getDate();
        const month = this.monthNames[this.currentDate.getMonth()];
        const year = this.currentDate.getFullYear();
        return `${dn} ${day} de ${month}, ${year}`;
    }

    get isToday(): boolean {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return this.currentDate.getTime() === today.getTime();
    }

    prevDay() {
        const d = new Date(this.currentDate);
        d.setDate(d.getDate() - 1);
        this.setDate(d);
        this.loadReservations();
    }

    nextDay() {
        const d = new Date(this.currentDate);
        d.setDate(d.getDate() + 1);
        this.setDate(d);
        this.loadReservations();
    }

    goToday() {
        this.setDate(new Date());
        this.loadReservations();
    }

    // ── Data loading ─────────────────────────────────────────

    loadClub() {
        this.http.get<any>(`${environment.apiUrl}/clubs/${this.clubId}`).subscribe({
            next: (club) => {
                this.clubName = club.name;
                this.enablePricing = club.enableCourtPricing || false;
                this.cdr.markForCheck();
            }
        });
    }

    loadCourts() {
        this.loading = true;
        this.courtService.getCourtsByClub(this.clubId).subscribe({
            next: (courts) => {
                this.courts = courts.filter(c => c.isActive);
                this.loadReservations();
            },
            error: () => {
                this.loading = false;
                this.toast.error('Error al cargar canchas');
                this.cdr.markForCheck();
            }
        });
    }

    loadReservations() {
        if (!this.clubId) return;
        this.courtService.getReservationsByClub(this.clubId, this.dateStr, this.dateStr).subscribe({
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

    // ── Grid helpers ─────────────────────────────────────────

    getReservationsForCourt(courtId: string): Reservation[] {
        return this.reservations.filter(r => r.courtId === courtId);
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
        if (res.paymentStatus === 'paid') return 'var(--success, #10b981)';
        if (res.paymentStatus === 'partial') return '#f59e0b';
        return 'var(--primary, #6366f1)';
    }

    // ── Reservation CRUD ─────────────────────────────────────

    openCreateModal(courtId: string, hour: number) {
        if (!this.canEdit) return;
        this.editingReservation = null;
        this.selectedCourtId = courtId;

        const startTime = `${hour.toString().padStart(2, '0')}:00`;
        const endTime = this.calcEndTime(startTime);

        this.reservationForm = {
            date: this.dateStr,
            startTime,
            endTime,
            title: '',
            players: ['', '', '', ''],
            playerCount: 4,
            priceType: 'full_court',
            basePrice: 0,
            finalPrice: 0,
            paymentStatus: 'pending',
            paymentNotes: ''
        };

        this.calculatePrice();
        this.showModal = true;
        this.cdr.markForCheck();
    }

    openEditModal(res: Reservation) {
        if (!this.canEdit) return;
        this.editingReservation = res;
        this.selectedCourtId = res.courtId;
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
            paymentNotes: res.paymentNotes || ''
        };

        this.showModal = true;
        this.cdr.markForCheck();
    }

    calcEndTime(start: string): string {
        const [h, m] = start.split(':').map(Number);
        let endMin = m + 30;
        let endH = h + 1;
        if (endMin >= 60) { endMin -= 60; endH++; }
        if (endH > this.endHour) endH = this.endHour;
        return `${endH.toString().padStart(2, '0')}:${endMin.toString().padStart(2, '0')}`;
    }

    onStartTimeChange() {
        this.reservationForm.endTime = this.calcEndTime(this.reservationForm.startTime);
        this.calculatePrice();
    }

    calculatePrice() {
        this.noPriceBlockMessage = '';
        if (!this.selectedCourtId || !this.enablePricing) return;

        const court = this.courts.find(c => c.id === this.selectedCourtId);
        if (!court?.priceBlocks?.length) {
            this.noPriceBlockMessage = 'Esta cancha no tiene precios configurados';
            return;
        }

        const date = this.reservationForm.date;
        const startTime = this.reservationForm.startTime;
        const dayOfWeek = new Date(date + 'T12:00:00').getDay();

        const block = court.priceBlocks.find(b =>
            b.daysOfWeek.includes(dayOfWeek) &&
            b.startTime <= startTime &&
            b.endTime > startTime
        );

        if (block) {
            const price = this.reservationForm.priceType === 'per_player'
                ? Number(block.pricePerPlayer)
                : Number(block.priceFullCourt);
            this.reservationForm.basePrice = price;
            if (!this.editingReservation) {
                this.reservationForm.finalPrice = price;
            }
        } else {
            const dayName = this.dayNames[dayOfWeek];
            this.noPriceBlockMessage = `Sin precio configurado para ${dayName} a las ${startTime}. Configura un bloque de precio en la gestión de canchas.`;
            this.reservationForm.basePrice = 0;
            if (!this.editingReservation) {
                this.reservationForm.finalPrice = 0;
            }
        }
        this.cdr.markForCheck();
    }

    onPriceTypeChange() {
        this.calculatePrice();
    }

    onCourtChange() {
        this.calculatePrice();
    }

    saveReservation() {
        if (!this.selectedCourtId) return;
        const court = this.courts.find(c => c.id === this.selectedCourtId);
        const players = this.reservationForm.players.filter(p => p.trim());
        const data: any = {
            courtId: this.selectedCourtId,
            clubId: this.clubId,
            date: this.reservationForm.date,
            startTime: this.reservationForm.startTime,
            endTime: this.reservationForm.endTime,
            title: this.reservationForm.title || undefined,
            players,
            playerCount: this.reservationForm.playerCount,
            priceType: this.reservationForm.priceType,
            finalPrice: this.reservationForm.finalPrice,
            paymentStatus: this.reservationForm.paymentStatus,
            paymentNotes: this.reservationForm.paymentNotes || undefined
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

    cancelReservation() {
        if (!this.editingReservation) return;
        if (!confirm('¿Cancelar esta reserva?')) return;
        this.courtService.cancelReservation(this.editingReservation.id).subscribe({
            next: () => {
                this.showModal = false;
                this.loadReservations();
                this.toast.success('Reserva cancelada');
            },
            error: () => this.toast.error('Error al cancelar reserva')
        });
    }

    // ── Player creation ─────────────────────────────────────

    onRequestCreatePlayer(name: string, slotIndex: number) {
        this.playerCreateInitialName = name;
        this.activePlayerSlotIndex = slotIndex;
        this.showPlayerCreateModal = true;
        this.cdr.markForCheck();
    }

    onPlayerCreated(player: any) {
        if (this.activePlayerSlotIndex >= 0 && this.activePlayerSlotIndex < this.reservationForm.players.length) {
            this.reservationForm.players[this.activePlayerSlotIndex] = player.name;
        }
        this.playerSelects.forEach(ps => ps.loadPlayers());
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

    getSelectedCourtName(): string {
        const court = this.courts.find(c => c.id === this.selectedCourtId);
        return court ? court.name : '';
    }

    // ── Helpers ───────────────────────────────────────────────

    trackByIndex(index: number): number {
        return index;
    }

    formatPrice(price: number): string {
        if (!price) return '0$';
        return new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 }).format(price) + '$';
    }
}
