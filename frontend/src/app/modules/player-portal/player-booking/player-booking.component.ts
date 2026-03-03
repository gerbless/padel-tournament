import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ClubService } from '../../../services/club.service';
import { AuthService } from '../../../services/auth.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmService } from '../../../services/confirm.service';

interface CourtSlot {
    startTime: string;
    endTime: string;
    priceFullCourt: number;
    pricePerPlayer: number;
    available: boolean;
}

interface CourtAvailability {
    courtId: string;
    courtName: string;
    courtNumber: number;
    surfaceType: string;
    slots: CourtSlot[];
}

@Component({
    selector: 'app-player-booking',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './player-booking.component.html',
    styleUrls: ['./player-booking.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PlayerBookingComponent implements OnInit {
    clubId = '';
    clubName = '';
    selectedDate = '';
    courts: CourtAvailability[] = [];
    loading = false;
    booking = false;

    selectedSlot: { court: CourtAvailability; slot: CourtSlot } | null = null;

    constructor(
        private http: HttpClient,
        private clubService: ClubService,
        private authService: AuthService,
        private toast: ToastService,
        private confirmService: ConfirmService,
        private cdr: ChangeDetectorRef
    ) {
        // Default to today
        const today = new Date();
        this.selectedDate = today.toISOString().split('T')[0];
    }

    ngOnInit() {
        this.clubService.selectedClub$.subscribe(club => {
            if (club) {
                this.clubId = club.id;
                this.clubName = club.name;
                this.loadSlots();
            }
        });
    }

    loadSlots() {
        if (!this.clubId || !this.selectedDate) return;
        this.loading = true;
        this.selectedSlot = null;
        this.cdr.markForCheck();

        this.http.get<CourtAvailability[]>(
            `${environment.apiUrl}/courts/club/${this.clubId}/available-slots`,
            { params: { date: this.selectedDate } }
        ).subscribe({
            next: (data) => {
                this.courts = data;
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: () => {
                this.loading = false;
                this.toast.error('Error al cargar disponibilidad');
                this.cdr.markForCheck();
            }
        });
    }

    onDateChange() {
        this.loadSlots();
    }

    selectSlot(court: CourtAvailability, slot: CourtSlot) {
        if (!slot.available) return;
        this.selectedSlot = { court, slot };
        this.cdr.markForCheck();
    }

    async confirmBooking() {
        if (!this.selectedSlot) return;

        if (!this.authService.isAuthenticated()) {
            this.toast.warning('Debes iniciar sesión para reservar');
            return;
        }

        const { court, slot } = this.selectedSlot;
        const ok = await this.confirmService.confirm({
            title: 'Confirmar Reserva',
            message: `¿Reservar <strong>${court.courtName}</strong> el <strong>${this.formatDate(this.selectedDate)}</strong> de <strong>${slot.startTime} a ${slot.endTime}</strong>?<br><br>Precio: <strong>${this.formatPrice(slot.priceFullCourt)}</strong>`,
            confirmText: 'Reservar',
            confirmClass: 'btn-primary'
        });

        if (!ok) return;

        this.booking = true;
        this.cdr.markForCheck();

        this.http.post(`${environment.apiUrl}/courts/player-booking`, {
            courtId: court.courtId,
            clubId: this.clubId,
            date: this.selectedDate,
            startTime: slot.startTime,
            endTime: slot.endTime,
        }).subscribe({
            next: () => {
                this.booking = false;
                this.toast.success('¡Reserva confirmada!');
                this.selectedSlot = null;
                this.loadSlots(); // Refresh availability
            },
            error: (err) => {
                this.booking = false;
                this.toast.error(err.error?.message || 'Error al crear reserva');
                this.cdr.markForCheck();
            }
        });
    }

    formatPrice(price: number): string {
        if (!price) return '$0';
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
    }

    formatDate(dateStr: string): string {
        const d = new Date(dateStr + 'T12:00:00');
        return d.toLocaleDateString('es-CL', { weekday: 'long', day: 'numeric', month: 'long' });
    }

    get isLoggedIn(): boolean {
        return this.authService.isAuthenticated();
    }

    get minDate(): string {
        return new Date().toISOString().split('T')[0];
    }

    hasAvailableSlots(court: CourtAvailability): boolean {
        return court.slots.some(s => s.available);
    }

    getAvailableSlots(court: CourtAvailability): CourtSlot[] {
        return court.slots.filter(s => s.available);
    }

    hasAnyAvailableSlot(): boolean {
        return this.courts.some(c => c.slots.some(s => s.available));
    }
}
