import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ToastService, Toast } from '../../services/toast.service';

@Component({
    selector: 'app-toast',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="toast-container">
        <div
            *ngFor="let toast of toasts; trackBy: trackById"
            class="toast"
            [class.toast-success]="toast.type === 'success'"
            [class.toast-error]="toast.type === 'error'"
            [class.toast-warning]="toast.type === 'warning'"
            [class.toast-info]="toast.type === 'info'"
            [class.toast-exit]="exiting.has(toast.id)"
            (click)="dismiss(toast)"
        >
            <span class="toast-icon">
                <ng-container [ngSwitch]="toast.type">
                    <span *ngSwitchCase="'success'">✅</span>
                    <span *ngSwitchCase="'error'">❌</span>
                    <span *ngSwitchCase="'warning'">⚠️</span>
                    <span *ngSwitchCase="'info'">ℹ️</span>
                </ng-container>
            </span>
            <span class="toast-message">{{ toast.message }}</span>
            <button class="toast-close" (click)="dismiss(toast); $event.stopPropagation()">×</button>
        </div>
    </div>
    `,
    styles: [`
        .toast-container {
            position: fixed;
            top: 1.5rem;
            right: 1.5rem;
            z-index: 10000;
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            pointer-events: none;
            max-width: 420px;
            width: calc(100% - 3rem);
        }

        .toast {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.875rem 1rem;
            border-radius: 12px;
            color: #fff;
            font-size: 0.9rem;
            font-weight: 500;
            box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
            backdrop-filter: blur(12px);
            pointer-events: auto;
            cursor: pointer;
            animation: slideIn 0.3s ease-out;
            transition: opacity 0.3s ease, transform 0.3s ease;
        }

        .toast-exit {
            opacity: 0;
            transform: translateX(100%);
        }

        .toast-success { background: linear-gradient(135deg, #059669, #10b981); }
        .toast-error   { background: linear-gradient(135deg, #dc2626, #ef4444); }
        .toast-warning { background: linear-gradient(135deg, #d97706, #f59e0b); color: #1a1a1a; }
        .toast-info    { background: linear-gradient(135deg, #2563eb, #3b82f6); }

        .toast-icon { font-size: 1.1rem; flex-shrink: 0; }
        .toast-message { flex: 1; line-height: 1.4; }

        .toast-close {
            background: none;
            border: none;
            color: inherit;
            font-size: 1.3rem;
            cursor: pointer;
            padding: 0 0.25rem;
            opacity: 0.7;
            flex-shrink: 0;
            line-height: 1;
        }
        .toast-close:hover { opacity: 1; }

        @keyframes slideIn {
            from { opacity: 0; transform: translateX(100%); }
            to   { opacity: 1; transform: translateX(0); }
        }

        @media (max-width: 768px) {
            .toast-container {
                top: auto;
                bottom: calc(5rem + env(safe-area-inset-bottom));
                right: 0.75rem;
                left: 0.75rem;
                max-width: none;
                width: auto;
            }
        }
    `]
})
export class ToastComponent implements OnInit, OnDestroy {
    toasts: Toast[] = [];
    exiting = new Set<number>();
    private sub!: Subscription;

    constructor(private toastService: ToastService) {}

    ngOnInit(): void {
        this.sub = this.toastService.toast$.subscribe(toast => {
            this.toasts.push(toast);
            setTimeout(() => this.dismiss(toast), toast.duration);
        });
    }

    ngOnDestroy(): void {
        this.sub?.unsubscribe();
    }

    dismiss(toast: Toast): void {
        if (this.exiting.has(toast.id)) return;
        this.exiting.add(toast.id);
        setTimeout(() => {
            this.toasts = this.toasts.filter(t => t.id !== toast.id);
            this.exiting.delete(toast.id);
        }, 300);
    }

    trackById(_: number, toast: Toast): number {
        return toast.id;
    }
}
