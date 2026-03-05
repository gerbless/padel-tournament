import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, tap } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PaymentConfig {
    publicKey: string;
    configured: boolean;
}

export interface PaymentPreference {
    preferenceId: string;
    initPoint: string;
    externalReference: string;
}

export interface PaymentStatus {
    id: string;
    reservationId: string;
    status: string;
    amount: number;
    mpPaymentId: string;
    createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
    private apiUrl = `${environment.apiUrl}/payments`;
    private _config: PaymentConfig | null = null;

    constructor(private http: HttpClient) {}

    getConfig(): Observable<PaymentConfig> {
        if (this._config) return of(this._config);
        return this.http.get<PaymentConfig>(`${this.apiUrl}/config`).pipe(
            tap(c => this._config = c)
        );
    }

    createPreference(reservationId: string, payerEmail?: string): Observable<PaymentPreference> {
        return this.http.post<PaymentPreference>(`${this.apiUrl}/create-preference`, {
            reservationId,
            payerEmail,
        });
    }

    createPaymentLink(reservationId: string): Observable<{ paymentUrl: string; shortUrl: string }> {
        return this.http.post<{ paymentUrl: string; shortUrl: string }>(`${this.apiUrl}/payment-link/${reservationId}`, {});
    }

    createPerPlayerLinks(reservationId: string): Observable<{
        links: { playerIndex: number; playerName: string; amount: number; paymentUrl: string; shortUrl: string; status: string }[];
    }> {
        return this.http.post<any>(`${this.apiUrl}/per-player-links/${reservationId}`, {});
    }

    createSinglePlayerLink(reservationId: string, playerIndex: number): Observable<{
        playerIndex: number; playerName: string; amount: number; paymentUrl: string; shortUrl: string; status: string;
    }> {
        return this.http.post<any>(`${this.apiUrl}/player-link/${reservationId}/${playerIndex}`, {});
    }

    getPaymentStatus(reservationId: string): Observable<PaymentStatus | null> {
        return this.http.get<PaymentStatus | null>(`${this.apiUrl}/status/${reservationId}`);
    }

    syncPayment(reservationId: string): Observable<{ status: string; synced: boolean }> {
        return this.http.post<{ status: string; synced: boolean }>(`${this.apiUrl}/sync/${reservationId}`, {});
    }

    getClubPayments(clubId: string, limit = 50): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/club/${clubId}`, { params: { limit: limit.toString() } });
    }
}
