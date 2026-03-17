import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ClubService } from '../../services/club.service';
import { ToastService } from '../../services/toast.service';
import { PhoneVerificationService } from '../../services/phone-verification.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

type Step = 'form' | 'otp' | 'done';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent {
    // ── Form fields ──────────────────────────────────────────────────────────
    name = '';
    email = '';
    password = '';
    passwordConfirm = '';
    identification = '';
    identificationType: 'RUT' | 'PASAPORTE' = 'RUT';
    phone = '';

    // ── Step control ─────────────────────────────────────────────────────────
    step: Step = 'form';
    otpCode = '';

    // ── State ─────────────────────────────────────────────────────────────────
    error = '';
    loading = false;
    sendingOtp = false;
    verifyingOtp = false;
    resendingVerification = false;
    phoneVerified = false;
    phoneVerificationToken = '';
    successMessage = '';
    otpSentTo = '';
    otpCountdown = 0;
    preregisteredFound = false;
    preregisteredCacheKey = '';
    maskedPlayerData: { name?: string; email?: string; identification?: string; phone?: string } | null = null;
    devOtpCode = '';

    private countdownInterval: any;

    // ── Club context ─────────────────────────────────────────────────────────
    clubId: string | null = null;
    clubName: string | null = null;
    /** Controlled from club settings — when false the OTP step is skipped entirely */
    clubEnablePhoneVerification = false;

    constructor(
        private http: HttpClient,
        private authService: AuthService,
        private clubService: ClubService,
        private router: Router,
        private cdr: ChangeDetectorRef,
        private toast: ToastService,
        private phoneVerificationService: PhoneVerificationService,
    ) {
        const club = this.clubService.getSelectedClub();
        if (club) {
            this.clubId = club.id;
            this.clubName = club.name;
            this.clubEnablePhoneVerification = club.enablePhoneVerification ?? false;
        }
    }

    // ── Identification formatting ─────────────────────────────────────────────
    onIdentificationInput(event: any) {
        const value = event.target.value;
        this.identification = this.identificationType === 'RUT'
            ? this.formatRut(value)
            : value.replace(/[^0-9]/g, '');
    }

    formatRut(val: string): string {
        let value = val.replace(/[^0-9kK]/g, '');
        if (value.length <= 1) return value;
        const dv = value.slice(-1);
        let body = value.slice(0, -1);
        if (body.length > 0) body = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        return `${body}-${dv}`;
    }

    // ── Pre-registration check (auto-fill) ────────────────────────────────────
    checkPreregistered() {
        if (!this.email.trim() && !this.identification.trim()) return;
        this.phoneVerificationService
            .checkPreregistered(this.email.trim() || undefined, this.identification.trim() || undefined)
            .subscribe({
                next: (res) => {
                    if (res.found) {
                        this.preregisteredFound = true;
                        this.preregisteredCacheKey = res.cacheKey || '';
                        const data = res.masked || res.player;
                        this.maskedPlayerData = data || null;
                        // Pre-fill name from masked data so user can recognize / correct it
                        if (data?.name) this.name = data.name;
                        // pre-fill email only if not already typed (masked email is less useful)
                        if (!this.email && data?.email) this.email = data.email;
                        if (!this.identification && data?.identification) this.identification = data.identification;
                        // Do NOT pre-fill phone: user must enter their own phone for OTP
                        this.toast.success('¡Encontramos un perfil registrado! Confirma tus datos.');
                    }
                    this.cdr.markForCheck();
                },
                error: () => { /* silent – don’t reveal errors */ }
            });
    }

    // ── Phone formatting ──────────────────────────────────────────────────────
    onPhoneInput(event: any) {
        let val = event.target.value.replace(/[^\d+]/g, '');
        if (val && !val.startsWith('+')) val = '+56' + val.replace(/^0+/, '');
        this.phone = val;
    }

    // ── Step 1: Validate form fields, then send OTP (or skip if disabled) ────
    sendOtp() {
        this.error = '';
        if (!this.name.trim()) { this.error = 'El nombre es obligatorio'; return; }
        if (!this.email.trim()) { this.error = 'El email es obligatorio'; return; }
        if (!this.phone.trim()) { this.error = 'El número de teléfono es obligatorio'; return; }
        if (!/^\+[1-9]\d{6,14}$/.test(this.phone)) {
            this.error = 'Ingresa el teléfono con código de país. Ejemplo: +56912345678';
            return;
        }
        if (this.password.length < 6) { this.error = 'La contraseña debe tener al menos 6 caracteres'; return; }
        if (this.password !== this.passwordConfirm) { this.error = 'Las contraseñas no coinciden'; return; }

        // If phone verification is disabled for this club, skip directly to registration
        if (!this.clubEnablePhoneVerification) {
            this.phoneVerified = true;
            this.phoneVerificationToken = '';
            this.register();
            return;
        }

        this.sendingOtp = true;
        this.cdr.markForCheck();

        this.phoneVerificationService.sendOtp(this.phone, this.clubName || undefined).subscribe({
            next: (res) => {
                this.sendingOtp = false;
                this.step = 'otp';
                this.otpSentTo = this.phone;
                this.devOtpCode = res.devCode || '';
                this.startCountdown(60);
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.sendingOtp = false;
                this.error = err.error?.message || 'Error al enviar el código de verificación';
                this.cdr.markForCheck();
            }
        });
    }

    resendOtp() {
        this.error = '';
        this.otpCode = '';
        this.sendingOtp = true;
        this.cdr.markForCheck();

        this.phoneVerificationService.sendOtp(this.phone, this.clubName || undefined).subscribe({
            next: (res) => {
                this.sendingOtp = false;
                this.devOtpCode = res.devCode || '';
                this.startCountdown(60);
                this.toast.success('Nuevo código enviado via WhatsApp');
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.sendingOtp = false;
                this.error = err.error?.message || 'Error al reenviar el código';
                this.cdr.markForCheck();
            }
        });
    }

    // ── Step 2: Verify OTP ────────────────────────────────────────────────────
    verifyOtp() {
        this.error = '';
        if (!this.otpCode || this.otpCode.length !== 6) {
            this.error = 'Ingresa el código de 6 dígitos recibido por WhatsApp';
            return;
        }
        this.verifyingOtp = true;
        this.cdr.markForCheck();

        this.phoneVerificationService.verifyOtp(this.phone, this.otpCode).subscribe({
            next: (res) => {
                this.verifyingOtp = false;
                this.phoneVerified = true;
                this.phoneVerificationToken = res.verificationToken;
                this.clearCountdown();
                this.toast.success('✅ Teléfono verificado correctamente');
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.verifyingOtp = false;
                this.error = err.error?.message || 'Código incorrecto. Intenta de nuevo.';
                this.cdr.markForCheck();
            }
        });
    }

    // ── Step 3: Final registration ────────────────────────────────────────────
    register() {
        // Only enforce phone verification check when it's enabled for this club
        if (this.clubEnablePhoneVerification && !this.phoneVerified) {
            this.error = 'Debes verificar tu número de teléfono antes de continuar';
            return;
        }
        this.error = '';
        this.loading = true;
        this.cdr.markForCheck();

        const body: any = {
            name: this.name.trim(),
            email: this.email.trim(),
            password: this.password,
            phone: this.phone,
            phoneVerificationToken: this.phoneVerificationToken,
        };
        if (this.identification.trim()) body.identification = this.identification.trim();
        if (this.clubId) body.clubId = this.clubId;
        if (this.preregisteredCacheKey) body.preregisteredCacheKey = this.preregisteredCacheKey;

        this.http.post<any>(`${environment.apiUrl}/auth/register`, body).subscribe({
            next: (response) => {
                this.loading = false;
                this.step = 'done';
                this.successMessage = response.message || 'Te enviamos un email de verificación. Revisa tu bandeja de entrada para activar tu cuenta.';
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.loading = false;
                this.error = err.error?.message || 'Error al registrarse';
                this.cdr.markForCheck();
            }
        });
    }

    resendVerification() {
        if (!this.email || this.resendingVerification) return;
        this.resendingVerification = true;
        this.cdr.markForCheck();
        this.http.post<any>(`${environment.apiUrl}/auth/resend-verification`, { email: this.email }).subscribe({
            next: (res) => {
                this.resendingVerification = false;
                this.toast.success(res.message || 'Email de verificación reenviado');
                this.cdr.markForCheck();
            },
            error: () => {
                this.resendingVerification = false;
                this.toast.error('Error al reenviar el email');
                this.cdr.markForCheck();
            }
        });
    }

    backToForm() {
        this.step = 'form';
        this.otpCode = '';
        this.error = '';
        this.clearCountdown();
        this.cdr.markForCheck();
    }

    private startCountdown(seconds: number) {
        this.clearCountdown();
        this.otpCountdown = seconds;
        this.countdownInterval = setInterval(() => {
            this.otpCountdown--;
            if (this.otpCountdown <= 0) this.clearCountdown();
            this.cdr.markForCheck();
        }, 1000);
    }

    private clearCountdown() {
        if (this.countdownInterval) clearInterval(this.countdownInterval);
        this.otpCountdown = 0;
    }
}
