import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { ClubService } from '../../services/club.service';
import { Club } from '../../models/club.model';
import { ToastService } from '../../services/toast.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'app-register',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterLink],
    templateUrl: './register.component.html',
    styleUrls: ['./register.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RegisterComponent {
    name = '';
    email = '';
    password = '';
    passwordConfirm = '';
    identification = '';
    identificationType: 'RUT' | 'PASAPORTE' = 'RUT';
    position: string = '';

    error = '';
    loading = false;
    registrationSuccess = false;
    successMessage = '';

    clubId: string | null = null;
    clubName: string | null = null;

    constructor(
        private http: HttpClient,
        private authService: AuthService,
        private clubService: ClubService,
        private router: Router,
        private cdr: ChangeDetectorRef,
        private toast: ToastService
    ) {
        const club = this.clubService.getSelectedClub();
        if (club) {
            this.clubId = club.id;
            this.clubName = club.name;
        }
    }

    onIdentificationInput(event: any) {
        const value = event.target.value;
        if (this.identificationType === 'RUT') {
            this.identification = this.formatRut(value);
        } else {
            this.identification = value.replace(/[^0-9]/g, '');
        }
    }

    formatRut(val: string): string {
        let value = val.replace(/[^0-9kK]/g, '');
        if (value.length <= 1) return value;
        const dv = value.slice(-1);
        let body = value.slice(0, -1);
        if (body.length > 0) {
            body = body.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
        }
        return `${body}-${dv}`;
    }

    register() {
        this.error = '';

        if (!this.name.trim()) {
            this.error = 'El nombre es obligatorio';
            return;
        }
        if (!this.email.trim()) {
            this.error = 'El email es obligatorio';
            return;
        }
        if (this.password.length < 6) {
            this.error = 'La contraseña debe tener al menos 6 caracteres';
            return;
        }
        if (this.password !== this.passwordConfirm) {
            this.error = 'Las contraseñas no coinciden';
            return;
        }

        this.loading = true;
        this.cdr.markForCheck();

        const body: any = {
            name: this.name.trim(),
            email: this.email.trim(),
            password: this.password,
        };
        if (this.identification.trim()) {
            body.identification = this.identification.trim();
        }
        if (this.clubId) {
            body.clubId = this.clubId;
        }

        this.http.post<any>(`${environment.apiUrl}/auth/register`, body).subscribe({
            next: (response) => {
                this.loading = false;
                this.registrationSuccess = true;
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
        if (!this.email) return;
        this.http.post<any>(`${environment.apiUrl}/auth/resend-verification`, { email: this.email }).subscribe({
            next: (res) => {
                this.toast.success(res.message || 'Email de verificación reenviado');
                this.cdr.markForCheck();
            },
            error: () => {
                this.toast.error('Error al reenviar el email');
                this.cdr.markForCheck();
            }
        });
    }
}
