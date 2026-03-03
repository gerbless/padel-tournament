import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import { ConfirmService, ConfirmEvent } from '../../services/confirm.service';

@Component({
    selector: 'app-confirm-modal',
    standalone: true,
    imports: [CommonModule],
    template: `
    <div class="modal-overlay" *ngIf="current" (click)="cancel()" @fadeIn>
        <div class="modal-content confirm-modal" (click)="$event.stopPropagation()" @slideIn>
            <div class="modal-header">
                <h3 class="modal-title">{{ current.options.title }}</h3>
                <button type="button" class="close-btn" (click)="cancel()">×</button>
            </div>
            <div class="modal-body">
                <p [innerHTML]="current.options.message"></p>
            </div>
            <div class="modal-footer">
                <button type="button" class="btn btn-secondary" (click)="cancel()">
                    {{ current.options.cancelText }}
                </button>
                <button type="button" class="btn" [ngClass]="current.options.confirmClass" (click)="ok()">
                    {{ current.options.confirmText }}
                </button>
            </div>
        </div>
    </div>
    `,
    styles: [`
        .modal-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.5);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10000;
            animation: fadeIn 0.2s ease;
        }
        .confirm-modal {
            background: var(--bg-primary, #fff);
            border-radius: 12px;
            width: 90%;
            max-width: 420px;
            box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
            animation: slideIn 0.25s ease;
            overflow: hidden;
        }
        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 1.25rem 1.5rem;
            border-bottom: 1px solid var(--border-color, #e5e7eb);
        }
        .modal-title {
            margin: 0;
            font-size: 1.1rem;
            font-weight: 600;
            color: var(--text-primary, #1f2937);
        }
        .close-btn {
            background: none;
            border: none;
            font-size: 1.5rem;
            cursor: pointer;
            color: var(--text-muted, #9ca3af);
            line-height: 1;
            padding: 0;
        }
        .close-btn:hover {
            color: var(--text-primary, #1f2937);
        }
        .modal-body {
            padding: 1.25rem 1.5rem;
        }
        .modal-body p {
            margin: 0;
            color: var(--text-secondary, #4b5563);
            font-size: 0.95rem;
            line-height: 1.5;
        }
        .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 0.75rem;
            padding: 1rem 1.5rem;
            border-top: 1px solid var(--border-color, #e5e7eb);
        }
        @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
        }
        @keyframes slideIn {
            from { opacity: 0; transform: scale(0.95) translateY(-10px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
        }
    `]
})
export class ConfirmModalComponent implements OnInit, OnDestroy {
    current: ConfirmEvent | null = null;
    private sub!: Subscription;

    constructor(private confirmService: ConfirmService) {}

    ngOnInit() {
        this.sub = this.confirmService.confirm$.subscribe(event => {
            this.current = event;
        });
    }

    ngOnDestroy() {
        this.sub?.unsubscribe();
    }

    ok() {
        this.current?.resolve(true);
        this.current = null;
    }

    cancel() {
        this.current?.resolve(false);
        this.current = null;
    }
}
