import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../environments/environment';

@Component({
    selector: 'app-verify-email',
    standalone: true,
    imports: [CommonModule, RouterLink],
    template: `
        <div class="verify-container fade-in">
            <div class="verify-card">
                <div class="logo">🎾 Agon Padel</div>

                <div *ngIf="loading" class="status">
                    <div class="spinner"></div>
                    <p>Verificando tu cuenta...</p>
                </div>

                <div *ngIf="!loading && success" class="status success">
                    <div class="icon">✅</div>
                    <h2>¡Email verificado!</h2>
                    <p>{{ message }}</p>
                    <a routerLink="/login" class="btn btn-primary btn-block">Iniciar Sesión</a>
                </div>

                <div *ngIf="!loading && !success" class="status error">
                    <div class="icon">❌</div>
                    <h2>Verificación fallida</h2>
                    <p>{{ message }}</p>
                    <a routerLink="/login" class="btn btn-primary btn-block">Ir al Login</a>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .verify-container {
            display: flex;
            justify-content: center;
            align-items: center;
            min-height: calc(100vh - 80px);
            padding: 1rem;
        }
        .verify-card {
            background: var(--bg-secondary);
            padding: 2.5rem;
            border-radius: 1rem;
            width: 100%;
            max-width: 420px;
            border: 1px solid var(--border);
            box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
            text-align: center;
        }
        .logo {
            font-size: 1.5rem;
            font-weight: 800;
            margin-bottom: 2rem;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            -webkit-background-clip: text;
            -webkit-text-fill-color: transparent;
        }
        .status { padding: 1rem 0; }
        .icon { font-size: 3rem; margin-bottom: 1rem; }
        h2 { margin-bottom: 0.5rem; font-size: 1.4rem; }
        p { color: var(--text-secondary); margin-bottom: 1.5rem; }
        .spinner {
            width: 40px; height: 40px;
            border: 4px solid var(--border);
            border-top-color: var(--primary);
            border-radius: 50%;
            animation: spin 0.8s linear infinite;
            margin: 0 auto 1rem;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        .btn-primary {
            display: inline-block;
            background: linear-gradient(135deg, var(--primary), var(--secondary));
            color: white;
            padding: 0.75rem 2rem;
            border-radius: 0.5rem;
            text-decoration: none;
            font-weight: 600;
        }
        .btn-block { width: 100%; text-align: center; }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class VerifyEmailComponent implements OnInit {
    loading = true;
    success = false;
    message = '';

    constructor(
        private route: ActivatedRoute,
        private http: HttpClient,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit() {
        const token = this.route.snapshot.queryParamMap.get('token');
        if (!token) {
            this.loading = false;
            this.success = false;
            this.message = 'Token de verificación no proporcionado.';
            this.cdr.markForCheck();
            return;
        }

        this.http.get<any>(`${environment.apiUrl}/auth/verify-email?token=${token}`).subscribe({
            next: (res) => {
                this.loading = false;
                this.success = true;
                this.message = res.message || 'Email verificado correctamente.';
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.loading = false;
                this.success = false;
                this.message = err.error?.message || 'Token de verificación inválido o expirado.';
                this.cdr.markForCheck();
            }
        });
    }
}
