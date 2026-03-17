import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef, DestroyRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ClubService } from '../../../services/club.service';
import { ToastService } from '../../../services/toast.service';
import { ConfirmService } from '../../../services/confirm.service';
import { PaymentService } from '../../../services/payment.service';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

interface Booking {
    id: string;
    date: string;
    startTime: string;
    endTime: string;
    title: string;
    status: string;
    paymentStatus: string;
    finalPrice: number;
    paymentExpiresAt: string | null;
    mpStatus: string | null;
    mpStatusDetail: string | null;
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
export class MyBookingsComponent implements OnInit, OnDestroy {
    private destroyRef = inject(DestroyRef);
    bookings: Booking[] = [];
    loading = true;
    clubId = '';
    clubName = '';
    mpConfigured = false;
    payingBookingId: string | null = null;
    cancellingBookingId: string | null = null;
    pendingConfirmationId: string | null = null;

    // Poll interval to reload bookings (catches webhook-driven deletions)
    private pollInterval: any;
    // Tick interval to refresh countdowns every second
    private tickInterval: any;

    constructor(
        private http: HttpClient,
        private clubService: ClubService,
        private toast: ToastService,
        private confirmService: ConfirmService,
        private paymentService: PaymentService,
        private route: ActivatedRoute,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        // Handle payment result from Mercado Pago redirect
        this.route.queryParams.subscribe(params => {
            const payment = params['payment'];
            const rid = params['rid'];
            if (payment === 'success') {
                this.toast.success('¡Pago exitoso! Tu reserva ha sido confirmada.');
                if (rid) {
                    this.paymentService.syncPayment(rid).subscribe({
                        next: () => this.loadBookings(),
                        error: () => this.loadBookings()
                    });
                }
            } else if (payment === 'failure') {
                this.toast.error('El pago fue rechazado. Tienes tiempo limitado para reintentar.');
                this.loadBookings();
            } else if (payment === 'pending') {
                this.toast.warning('El pago está pendiente de confirmación.');
                if (rid) {
                    this.pendingConfirmationId = rid;
                    this.cdr.markForCheck();
                    this.paymentService.syncPayment(rid).subscribe({
                        next: (res) => {
                            if (res.status === 'approved') {
                                this.pendingConfirmationId = null;
                            }
                            this.loadBookings();
                        },
                        error: () => this.loadBookings()
                    });
                }
            }
        });

        // Check if MP is configured — done inside selectedClub$ so clubId is available
        this.clubService.selectedClub$.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(club => {
            if (club) {
                this.clubId = club.id;
                this.clubName = club.name;
                this.paymentService.getConfig(club.id).subscribe({
                    next: (config) => {
                        this.mpConfigured = config.configured;
                        this.cdr.markForCheck();
                    },
                    error: () => {}
                });
                this.loadBookings();
            }
        });

        // Poll bookings every 10s to catch webhook-driven state changes
        this.pollInterval = setInterval(() => {
            if (this.pendingConfirmationId || this.hasPendingPayments() || this.hasExpiringBookings()) {
                this.loadBookings();
            }
        }, 10_000);

        // Tick every second to update countdown display
        this.tickInterval = setInterval(() => {
            if (this.hasExpiringBookings()) {
                this.cdr.markForCheck();
            }
        }, 1000);
    }

    ngOnDestroy() {
        if (this.pollInterval) clearInterval(this.pollInterval);
        if (this.tickInterval) clearInterval(this.tickInterval);
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
        if (this.cancellingBookingId) return;
        const ok = await this.confirmService.confirm({
            title: 'Cancelar Reserva',
            message: `¿Cancelar la reserva del <strong>${this.formatDate(booking.date)}</strong> de <strong>${booking.startTime} a ${booking.endTime}</strong>?`,
            confirmText: 'Cancelar Reserva',
            confirmClass: 'btn-danger'
        });

        if (!ok) return;

        this.cancellingBookingId = booking.id;
        this.cdr.markForCheck();
        this.http.delete(`${environment.apiUrl}/courts/player-bookings/${booking.id}`).subscribe({
            next: () => {
                this.cancellingBookingId = null;
                this.toast.success('Reserva cancelada');
                this.loadBookings();
            },
            error: (err) => {
                this.cancellingBookingId = null;
                this.toast.error(err.error?.message || 'Error al cancelar');
                this.cdr.markForCheck();
            }
        });
    }

    payBooking(booking: Booking) {
        this.payingBookingId = booking.id;
        this.cdr.markForCheck();

        this.paymentService.createPreference(booking.id).subscribe({
            next: (pref) => {
                this.payingBookingId = null;
                this.cdr.markForCheck();
                window.location.href = pref.initPoint;
            },
            error: (err) => {
                this.payingBookingId = null;
                this.toast.error(err.error?.message || 'Error al iniciar pago');
                this.cdr.markForCheck();
            }
        });
    }

    formatPrice(price: number): string {
        if (!price) return '$0';
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
    }

    hasPendingPayments(): boolean {
        return this.bookings.some(b => b.mpStatusDetail === 'pending_contingency' || b.mpStatus === 'in_process');
    }

    /**
     * Get remaining seconds from server-set paymentExpiresAt.
     * Returns 0 for pending_contingency bookings (no countdown for those).
     */
    getRemainingSeconds(booking: Booking): number {
        if (!booking.paymentExpiresAt || booking.mpStatusDetail === 'pending_contingency') return 0;
        const expiresAt = new Date(booking.paymentExpiresAt).getTime();
        return Math.max(0, Math.ceil((expiresAt - Date.now()) / 1000));
    }

    hasExpiringBookings(): boolean {
        return this.bookings.some(b => b.paymentExpiresAt && b.mpStatusDetail !== 'pending_contingency' && this.getRemainingSeconds(b) > 0);
    }

    /**
     * Check if a booking's payment deadline has expired (timer reached 0).
     * Does NOT apply to pending_contingency bookings.
     */
    isExpired(booking: Booking): boolean {
        if (!booking.paymentExpiresAt || booking.mpStatusDetail === 'pending_contingency') return false;
        return new Date(booking.paymentExpiresAt).getTime() <= Date.now();
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
        return this.bookings.filter(b => !this.isPast(b) && !this.isExpired(b));
    }

    get pastBookings(): Booking[] {
        return this.bookings.filter(b => this.isPast(b));
    }
}
