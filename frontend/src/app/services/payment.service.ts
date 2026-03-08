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
    // Cache per club (key = clubId or '_global' for calls without a clubId)
    private _configs = new Map<string, PaymentConfig>();

    constructor(private http: HttpClient) {}

    /** Clear cached config so the next getConfig() fetches fresh data from the server. */
    clearCache(clubId?: string): void {
        if (clubId) {
            this._configs.delete(clubId);
        } else {
            this._configs.clear();
        }
    }

    getConfig(clubId?: string): Observable<PaymentConfig> {
        const key = clubId || '_global';
        if (this._configs.has(key)) return of(this._configs.get(key)!);
        const url = clubId
            ? `${this.apiUrl}/config?clubId=${clubId}`
            : `${this.apiUrl}/config`;
        return this.http.get<PaymentConfig>(url).pipe(
            tap(c => this._configs.set(key, c))
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

    getPlayerContactStatus(playerId: string): Observable<{
        email: string | null;
        phone: string | null;
        isEmailVerified: boolean;
        isPhoneVerified: boolean;
    }> {
        return this.http.get<any>(`${environment.apiUrl}/players/${playerId}/contact-status`);
    }

    sendPlayerLink(payload: {
        channel: 'whatsapp' | 'email';
        contact: string;
        playerName: string;
        link: string;
        clubName: string;
        date: string;
        time: string;
        courtName: string;
        amount: number;
    }): Observable<{ sent: boolean; channel: string }> {
        return this.http.post<{ sent: boolean; channel: string }>(`${this.apiUrl}/send-player-link`, payload);
    }
}
