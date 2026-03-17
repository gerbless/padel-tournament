
import { Component, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';
import { ToastService } from '../../services/toast.service';

@Component({
    selector: 'app-login',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './login.component.html',
    styleUrls: ['./login.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LoginComponent {
    username = '';
    password = '';
    error = '';
    loading = false;
    showResend = false;
    resendingVerification = false;

    constructor(
        private authService: AuthService,
        private router: Router,
        private cdr: ChangeDetectorRef,
        private http: HttpClient,
        private toast: ToastService
    ) { }

    login() {
        this.loading = true;
        this.error = '';
        this.showResend = false;

        this.authService.login(this.username, this.password).subscribe({
            next: () => {
                this.loading = false;
                this.cdr.markForCheck();
                const user = this.authService.getCurrentUser();
                if (user && user.role === 'user' && (!user.clubRoles || user.clubRoles.length === 0)) {
                    this.router.navigate(['/player/booking']);
                } else {
                    this.router.navigate(['/courts']);
                }
            },
            error: (err) => {
                console.error(err);
                this.loading = false;

                if (err.status === 403) {
                    this.error = err.error?.message || 'Debes verificar tu email antes de iniciar sesión.';
                    this.showResend = true;
                } else {
                    this.error = 'Credenciales inválidas o error en el servidor';
                }
                this.cdr.markForCheck();
            }
        });
    }

    resendVerification() {
        if (!this.username || this.resendingVerification) return;
        this.resendingVerification = true;
        this.cdr.markForCheck();
        this.http.post<any>(`${environment.apiUrl}/auth/resend-verification`, { email: this.username }).subscribe({
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
}
