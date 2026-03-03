import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ClubService } from '../../../services/club.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmService } from '../../../services/confirm.service';

interface Booking {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    title: string;
    status: string;
    paymentStatus: string;
    finalPrice: number;
    court?: { name: string; courtNumber: number };
}

@Component({
    selector: 'app-my-bookings',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './my-bookings.component.html',
    styleUrls: ['./my-bookings.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class MyBookingsComponent implements OnInit {
    bookings: Booking[] = [];
    loading = true;
    clubId = '';
    clubName = '';

    constructor(
        private http: HttpClient,
        private clubService: ClubService,
        private toast: ToastService,
        private confirmService: ConfirmService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.clubService.selectedClub$.subscribe(club => {
            if (club) {
                this.clubId = club.id;
                this.clubName = club.name;
                this.loadBookings();
            }
        });
    }

    loadBookings() {
        this.loading = true;
        this.cdr.markForCheck();

        const params: any = {};
        if (this.clubId) params.clubId = this.clubId;

        this.http.get<Booking[]>(`${environment.apiUrl}/courts/player-bookings/my`, { params }).subscribe({
            next: (data) => {
                this.bookings = data;
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

    async cancelBooking(booking: Booking) {
        const ok = await this.confirmService.confirm({
            title: 'Cancelar Reserva',
            message: `¿Cancelar la reserva del <strong>${this.formatDate(booking.date)}</strong> de <strong>${booking.startTime} a ${booking.endTime}</strong>?`,
            confirmText: 'Cancelar Reserva',
            confirmClass: 'btn-danger'
        });

        if (!ok) return;

        this.http.delete(`${environment.apiUrl}/courts/player-bookings/${booking.id}`).subscribe({
            next: () => {
                this.toast.success('Reserva cancelada');
                this.loadBookings();
            },
            error: (err) => {
                this.toast.error(err.error?.message || 'Error al cancelar');
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
        return d.toLocaleDateString('es-CL', { weekday: 'short', day: 'numeric', month: 'short' });
    }

    isPast(booking: Booking): boolean {
        const bookingDate = new Date(booking.date + 'T' + booking.endTime);
        return bookingDate < new Date();
    }

    get upcomingBookings(): Booking[] {
        return this.bookings.filter(b => !this.isPast(b));
    }

    get pastBookings(): Booking[] {
        return this.bookings.filter(b => this.isPast(b));
    }
}
