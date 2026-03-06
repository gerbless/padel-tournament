import { Component, Input, Output, EventEmitter, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ToastService } from '../../services/toast.service';
import { PaymentService } from '../../services/payment.service';

export interface PaymentLinkData {
    playerName?: string;
    amount?: number;
    paymentUrl: string;
    shortUrl: string;
    status: string;
    /** Player index in the reservation (0-based). Used to correlate with contact status. */
    playerIndex?: number;
    email?: string | null;
    phone?: string | null;
    isEmailVerified?: boolean;
    isPhoneVerified?: boolean;
}

export interface ReservationContext {
    clubName: string;
    date: string;       // YYYY-MM-DD
    courtName: string;
    startTime: string;  // HH:mm
    endTime: string;    // HH:mm
}

@Component({
    selector: 'app-payment-link-modal',
    standalone: true,
    imports: [CommonModule],
    template: `
        <div class="modal-overlay" (click)="close.emit()">
            <div class="modal-content" (click)="$event.stopPropagation()">
                <div class="modal-header">
                    <h2>💳 Links de Pago</h2>
                    <button class="modal-close" (click)="close.emit()">✕</button>
                </div>
                <div class="modal-body">
                    <!-- Loading -->
                    <div *ngIf="loading" class="loading-state">
                        <div class="spinner"></div>
                        <p>Generando links de pago...</p>
                    </div>

                    <!-- Single link (full court) -->
                    <div *ngIf="!loading && links.length === 1" class="link-section">
                        <div class="link-card">
                            <div class="link-info">
                                <span class="link-label">Link de pago completo</span>
                                <span *ngIf="links[0].amount" class="link-amount">{{ formatPrice(links[0].amount!) }}</span>
                            </div>
                            <div class="link-url-row">
                                <input type="text" [value]="links[0].shortUrl || links[0].paymentUrl"
                                    class="link-input" readonly #singleLink>
                                <button class="btn-copy" (click)="copyLink(links[0].shortUrl || links[0].paymentUrl)">
                                    📋 Copiar
                                </button>
                            </div>
                            <div class="send-actions" *ngIf="reservationContext">
                                <button *ngIf="links[0].email"
                                    class="btn-send btn-send-email"
                                    [disabled]="sendingState[0] === 'sending'"
                                    (click)="sendLink(links[0], 0, 'email')">
                                    <span *ngIf="sendingState[0] === 'sending'">⏳</span>
                                    <span *ngIf="sendingState[0] !== 'sending'">📧</span>
                                    Email
                                    <span *ngIf="links[0].isEmailVerified" class="verified-badge" title="Email verificado">✅</span>
                                </button>
                                <button *ngIf="links[0].phone"
                                    class="btn-send btn-send-whatsapp"
                                    [disabled]="sendingState[0] === 'sending'"
                                    (click)="sendLink(links[0], 0, 'whatsapp')">
                                    <span *ngIf="sendingState[0] === 'sending'">⏳</span>
                                    <span *ngIf="sendingState[0] !== 'sending'">💬</span>
                                    WhatsApp
                                    <span *ngIf="links[0].isPhoneVerified" class="verified-badge" title="Teléfono verificado">✅</span>
                                </button>
                            </div>
                        </div>
                    </div>

                    <!-- Multiple links (per player) -->
                    <div *ngIf="!loading && links.length > 1" class="link-section">
                        <div *ngFor="let link of links; let i = index" class="link-card"
                             [class.paid]="link.status === 'paid'">
                            <div class="link-info">
                                <span class="link-label">
                                    <span class="player-index">{{ i + 1 }}</span>
                                    {{ link.playerName }}
                                </span>
                                <span class="link-amount">{{ formatPrice(link.amount!) }}</span>
                                <span class="link-status" [ngClass]="'status-' + link.status">
                                    {{ link.status === 'paid' ? '✅ Pagado' : link.status === 'error' ? '❌ Error' : '⏳ Pendiente' }}
                                </span>
                            </div>
                            <div *ngIf="link.status !== 'paid' && link.paymentUrl" class="link-url-row">
                                <input type="text" [value]="link.shortUrl || link.paymentUrl"
                                    class="link-input" readonly>
                                <button class="btn-copy" (click)="copyLink(link.shortUrl || link.paymentUrl)">
                                    📋 Copiar
                                </button>
                            </div>
                            <!-- Send via email / WhatsApp -->
                            <div class="send-actions" *ngIf="link.status !== 'paid' && reservationContext && (link.email || link.phone)">
                                <button *ngIf="link.email"
                                    class="btn-send btn-send-email"
                                    [disabled]="sendingState[i] === 'sending'"
                                    (click)="sendLink(link, i, 'email')">
                                    <span *ngIf="sendingState[i] === 'sending'">⏳</span>
                                    <span *ngIf="sendingState[i] !== 'sending'">📧</span>
                                    Email
                                    <span *ngIf="link.isEmailVerified" class="verified-badge">✅</span>
                                </button>
                                <button *ngIf="link.phone"
                                    class="btn-send btn-send-whatsapp"
                                    [disabled]="sendingState[i] === 'sending'"
                                    (click)="sendLink(link, i, 'whatsapp')">
                                    <span *ngIf="sendingState[i] === 'sending'">⏳</span>
                                    <span *ngIf="sendingState[i] !== 'sending'">💬</span>
                                    WhatsApp
                                    <span *ngIf="link.isPhoneVerified" class="verified-badge">✅</span>
                                </button>
                            </div>
                        </div>
                        <div class="copy-all-row">
                            <button class="btn-copy-all" (click)="copyAllLinks()">
                                📋 Copiar todos los links
                            </button>
                        </div>
                    </div>

                    <!-- Error -->
                    <div *ngIf="!loading && error" class="error-state">
                        <p>❌ {{ error }}</p>
                    </div>
                </div>
            </div>
        </div>
    `,
    styles: [`
        .modal-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.5); display: flex; align-items: center;
            justify-content: center; z-index: 9999; animation: fadeIn 0.2s;
        }
        .modal-content {
            background: white; border-radius: 12px; width: 95%; max-width: 520px;
            max-height: 80vh; overflow-y: auto; box-shadow: 0 20px 60px rgba(0,0,0,0.3);
        }
        .modal-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 16px 20px; border-bottom: 1px solid #eee;
        }
        .modal-header h2 { margin: 0; font-size: 1.1rem; }
        .modal-close {
            background: none; border: none; font-size: 1.3rem; cursor: pointer;
            padding: 4px 8px; border-radius: 6px; color: #666;
        }
        .modal-close:hover { background: #f0f0f0; }
        .modal-body { padding: 16px 20px; }

        .loading-state {
            text-align: center; padding: 32px 0;
        }
        .spinner {
            width: 36px; height: 36px; border: 3px solid #e0e0e0;
            border-top-color: #009ee3; border-radius: 50%;
            animation: spin 0.8s linear infinite; margin: 0 auto 12px;
        }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }

        .link-card {
            background: #f8f9fa; border-radius: 8px; padding: 12px 14px;
            margin-bottom: 10px; border: 1px solid #e9ecef;
        }
        .link-card.paid {
            background: #e8f5e9; border-color: #c8e6c9;
        }
        .link-info {
            display: flex; align-items: center; gap: 8px; margin-bottom: 8px;
            flex-wrap: wrap;
        }
        .link-label { font-weight: 600; flex: 1; }
        .player-index {
            display: inline-flex; align-items: center; justify-content: center;
            width: 22px; height: 22px; border-radius: 50%; background: #009ee3;
            color: white; font-size: 0.75rem; font-weight: 700; margin-right: 4px;
        }
        .link-amount {
            font-weight: 600; color: #2e7d32; font-size: 0.95rem;
        }
        .link-status { font-size: 0.85rem; }
        .status-paid { color: #2e7d32; }
        .status-pending { color: #f57c00; }
        .status-error { color: #c62828; }

        .link-url-row {
            display: flex; gap: 8px; align-items: center;
        }
        .link-input {
            flex: 1; padding: 8px 10px; border: 1px solid #ddd; border-radius: 6px;
            font-size: 0.85rem; background: white; color: #333;
            overflow: hidden; text-overflow: ellipsis;
        }
        .btn-copy {
            padding: 8px 14px; background: #009ee3; color: white; border: none;
            border-radius: 6px; font-size: 0.85rem; cursor: pointer;
            white-space: nowrap; font-weight: 600;
        }
        .btn-copy:hover { background: #0079b3; }
        .btn-copy:active { transform: scale(0.96); }

        .copy-all-row {
            text-align: center; margin-top: 12px;
        }
        .btn-copy-all {
            padding: 10px 20px; background: #1565c0; color: white; border: none;
            border-radius: 8px; font-size: 0.9rem; cursor: pointer; font-weight: 600;
        }
        .btn-copy-all:hover { background: #0d47a1; }

        .send-actions {
            display: flex; gap: 8px; flex-wrap: wrap; margin-top: 8px; padding-top: 8px;
            border-top: 1px solid #e9ecef;
        }
        .btn-send {
            display: inline-flex; align-items: center; gap: 6px;
            padding: 7px 14px; border: none; border-radius: 6px;
            font-size: 0.82rem; font-weight: 600; cursor: pointer;
            transition: background 0.15s; white-space: nowrap;
        }
        .btn-send:disabled { opacity: 0.6; cursor: not-allowed; }
        .btn-send-email { background: #0ea5e9; color: white; }
        .btn-send-email:hover:not(:disabled) { background: #0284c7; }
        .btn-send-whatsapp { background: #25d366; color: white; }
        .btn-send-whatsapp:hover:not(:disabled) { background: #16a34a; }
        .verified-badge { font-size: 0.75rem; }

        .error-state { text-align: center; padding: 20px; color: #c62828; }
    `],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PaymentLinkModalComponent {
    @Input() links: PaymentLinkData[] = [];
    @Input() loading = false;
    @Input() error = '';
    @Input() reservationContext: ReservationContext | null = null;
    @Output() close = new EventEmitter<void>();

    sendingState: Record<number, 'idle' | 'sending' | 'sent' | 'error'> = {};

    constructor(
        private toast: ToastService,
        private paymentService: PaymentService,
        private cdr: ChangeDetectorRef,
    ) {}

    sendLink(link: PaymentLinkData, playerIndex: number, channel: 'email' | 'whatsapp') {
        if (!this.reservationContext) return;
        const contact = channel === 'email' ? link.email : link.phone;
        if (!contact) return;

        this.sendingState[playerIndex] = 'sending';
        this.cdr.markForCheck();

        const ctx = this.reservationContext;
        const timeStr = `${ctx.startTime} - ${ctx.endTime}`;

        this.paymentService.sendPlayerLink({
            channel,
            contact,
            playerName: link.playerName || 'Jugador',
            link: link.shortUrl || link.paymentUrl,
            clubName: ctx.clubName,
            date: ctx.date,
            time: timeStr,
            courtName: ctx.courtName,
            amount: link.amount || 0,
        }).subscribe({
            next: () => {
                this.sendingState[playerIndex] = 'sent';
                const channelLabel = channel === 'email' ? 'email' : 'WhatsApp';
                this.toast.success(`Link enviado por ${channelLabel} a ${link.playerName}`);
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.sendingState[playerIndex] = 'error';
                this.toast.error(err?.error?.message || `Error al enviar el link`);
                this.cdr.markForCheck();
            },
        });
    }

    copyLink(url: string) {
        navigator.clipboard.writeText(url).then(() => {
            this.toast.success('Link copiado al portapapeles');
        }).catch(() => {
            // Fallback
            const textarea = document.createElement('textarea');
            textarea.value = url;
            document.body.appendChild(textarea);
            textarea.select();
            document.execCommand('copy');
            document.body.removeChild(textarea);
            this.toast.success('Link copiado');
        });
    }

    copyAllLinks() {
        const text = this.links
            .filter(l => l.status !== 'paid' && l.paymentUrl)
            .map(l => `${l.playerName}: ${l.shortUrl || l.paymentUrl}`)
            .join('\n');
        navigator.clipboard.writeText(text).then(() => {
            this.toast.success('Todos los links copiados al portapapeles');
        }).catch(() => {
            this.toast.error('Error al copiar');
        });
    }

    formatPrice(price: number): string {
        if (!price) return '$0';
        return new Intl.NumberFormat('es-CL', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(price);
    }
}
