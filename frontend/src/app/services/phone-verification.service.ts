import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface SendOtpResponse {
    sent: boolean;
    devCode?: string; // only in non-production mode
}

export interface VerifyOtpResponse {
    verified: boolean;
    verificationToken: string;
}

export interface PreregisteredPlayerResponse {
    found: boolean;
    /** One-time key to reference the original (real) player data during registration. */
    cacheKey?: string;
    /** Masked player data for display/recognition. Never contains real PII. */
    masked?: {
        name: string;
        email: string;
        identification?: string;
        phone?: string;
    };
    /**
     * @deprecated Use `masked` instead. Kept for backwards-compat during transition.
     */
    player?: {
        name: string;
        email: string;
        identification?: string;
        phone?: string;
    };
}

@Injectable({ providedIn: 'root' })
export class PhoneVerificationService {
    private readonly apiUrl = environment.apiUrl;

    constructor(private http: HttpClient) {}

    /**
     * Send OTP via WhatsApp to the given phone number.
     * Phone must be in E.164 format: +56912345678
     */
    sendOtp(phone: string, clubName?: string): Observable<SendOtpResponse> {
        return this.http.post<SendOtpResponse>(`${this.apiUrl}/phone-verification/send`, {
            phone,
            clubName,
        });
    }

    /**
     * Verify the 6-digit OTP entered by the user.
     * Returns a verificationToken to include in the registration payload.
     */
    verifyOtp(phone: string, code: string): Observable<VerifyOtpResponse> {
        return this.http.post<VerifyOtpResponse>(`${this.apiUrl}/phone-verification/verify`, {
            phone,
            code,
        });
    }

    /**
     * Check if an admin has pre-registered a player with given email or identification.
     * Returns player data to auto-fill the registration form.
     */
    checkPreregistered(email?: string, identification?: string): Observable<PreregisteredPlayerResponse> {
        return this.http.post<PreregisteredPlayerResponse>(`${this.apiUrl}/auth/check-preregistered`, {
            email,
            identification,
        });
    }

    /**
     * Format a raw phone input to E.164.
     * Assumes Chilean numbers (+56) if no country code is provided.
     */
    static formatPhoneE164(phone: string, defaultCountryCode = '56'): string {
        const digits = phone.replace(/\D/g, '');
        if (phone.startsWith('+')) return '+' + digits;
        if (digits.startsWith('0')) return '+' + defaultCountryCode + digits.slice(1);
        return '+' + defaultCountryCode + digits;
    }
}
