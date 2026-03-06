import { Component, Input, Output, EventEmitter, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CourtService } from '../../services/court.service';
import { FreePlayMatch } from '../../models/court.model';
import { ToastService } from '../../services/toast.service';

@Component({
    selector: 'app-score-modal',
    standalone: true,
    imports: [CommonModule, FormsModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div class="score-overlay" (click)="close.emit()">
        <div class="score-modal" (click)="$event.stopPropagation()">
            <div class="score-header">
                <h2>📊 Marcador</h2>
                <button class="modal-close" (click)="close.emit()">×</button>
            </div>

            <div class="score-body">
                <!-- Team Assignment -->
                <div class="teams-section">
                    <h3>Equipos <span class="teams-hint" *ngIf="!matchSaved">· Tocá un jugador para moverlo</span></h3>
                    <div class="teams-grid">
                        <div class="team-box team1" [class.team-full]="team1Names.length >= 2">
                            <h4>🔵 Equipo 1</h4>
                            <div class="team-players">
                                <span class="team-player team-player-movable" 
                                    *ngFor="let name of team1Names; let i = index"
                                    (click)="!matchSaved && moveToTeam2(i)"
                                    [class.readonly]="matchSaved">{{ name }} <span class="move-icon" *ngIf="!matchSaved">→</span></span>
                                <span class="team-player team-player-empty" *ngIf="team1Names.length < 2">Falta 1 jugador</span>
                            </div>
                        </div>
                        <div class="vs-divider">VS</div>
                        <div class="team-box team2" [class.team-full]="team2Names.length >= 2">
                            <h4>🔴 Equipo 2</h4>
                            <div class="team-players">
                                <span class="team-player team-player-movable" 
                                    *ngFor="let name of team2Names; let i = index"
                                    (click)="!matchSaved && moveToTeam1(i)"
                                    [class.readonly]="matchSaved">{{ name }} <span class="move-icon" *ngIf="!matchSaved">←</span></span>
                                <span class="team-player team-player-empty" *ngIf="team2Names.length < 2">Falta 1 jugador</span>
                            </div>
                        </div>
                    </div>
                    <div class="teams-warning" *ngIf="!teamsBalanced && !matchSaved">⚠️ Cada equipo debe tener 2 jugadores</div>
                </div>

                <!-- Sets -->
                <div class="sets-section">
                    <h3>Sets</h3>
                    <div class="sets-grid">
                        <div *ngFor="let set of sets; let i = index" class="set-row">
                            <span class="set-label">Set {{ i + 1 }}</span>
                            <div class="set-score">
                                <input type="number" [(ngModel)]="set.team1" min="0" max="7"
                                    class="score-input team1-score" [readonly]="matchSaved"
                                    (ngModelChange)="evaluateWinner()">
                                <span class="score-dash">–</span>
                                <input type="number" [(ngModel)]="set.team2" min="0" max="7"
                                    class="score-input team2-score" [readonly]="matchSaved"
                                    (ngModelChange)="evaluateWinner()">
                            </div>
                            <button *ngIf="i === sets.length - 1 && sets.length > 1 && !matchSaved"
                                class="btn-icon btn-remove-set" (click)="removeSet(i)" title="Quitar set">✕</button>
                        </div>
                    </div>
                    <button *ngIf="sets.length < 5 && !matchSaved" class="btn btn-sm btn-outline add-set-btn" (click)="addSet()">
                        + Agregar Set
                    </button>
                </div>

                <!-- Winner -->
                <div class="winner-section" *ngIf="winner">
                    <div class="winner-badge" [class.team1-winner]="winner === 1" [class.team2-winner]="winner === 2">
                        🏆 Ganador: {{ winner === 1 ? 'Equipo 1' : 'Equipo 2' }}
                        <span class="winner-names">({{ winner === 1 ? team1Names.join(' / ') : team2Names.join(' / ') }})</span>
                    </div>
                </div>

                <!-- Ranking toggle -->
                <div class="ranking-toggle-section">
                    <label class="ranking-toggle">
                        <input type="checkbox" [(ngModel)]="countsForRanking" [disabled]="matchSaved">
                        <span class="toggle-text">⭐ Sumar puntos al ranking</span>
                    </label>
                    <small class="ranking-hint" *ngIf="countsForRanking">
                        El ganador recibirá <strong>{{ pointsPerWin }}</strong> puntos
                    </small>
                </div>
            </div>

            <div class="score-footer">
                <button *ngIf="matchSaved && !matchSaved" class="btn btn-danger btn-sm" (click)="deleteMatch()">
                    🗑️ Eliminar Marcador
                </button>
                <button *ngIf="existingMatch" class="btn btn-danger btn-sm" (click)="deleteMatch()">
                    🗑️ Eliminar Marcador
                </button>
                <div class="spacer"></div>
                <button class="btn btn-secondary" (click)="close.emit()">Cerrar</button>
                <button *ngIf="!matchSaved" class="btn btn-primary" (click)="saveMatch()" [disabled]="saving || !hasValidScore">
                    {{ saving ? '⏳ Guardando...' : '💾 Guardar Marcador' }}
                </button>
            </div>
        </div>
    </div>
    `,
    styles: [`
        .score-overlay {
            position: fixed; top: 0; left: 0; right: 0; bottom: 0;
            background: rgba(0,0,0,0.6); z-index: 1100;
            display: flex; align-items: center; justify-content: center;
            padding: 1rem;
        }
        .score-modal {
            background: var(--bg-card, #1e1e2e); border-radius: 12px;
            width: 100%; max-width: 520px; max-height: 90vh; overflow-y: auto;
            box-shadow: 0 20px 60px rgba(0,0,0,0.5);
        }
        .score-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 1rem 1.5rem; border-bottom: 1px solid var(--border, #333);
        }
        .score-header h2 { margin: 0; font-size: 1.2rem; }
        .modal-close {
            background: none; border: none; font-size: 1.5rem;
            color: var(--text-muted); cursor: pointer;
        }
        .score-body { padding: 1.5rem; }
        .score-footer {
            padding: 1rem 1.5rem; border-top: 1px solid var(--border, #333);
            display: flex; gap: 0.5rem; align-items: center;
        }
        .spacer { flex: 1; }

        /* Teams */
        .teams-section h3, .sets-section h3 { font-size: 0.95rem; margin-bottom: 0.75rem; color: var(--text-muted); }
        .teams-grid {
            display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.75rem; align-items: center;
            margin-bottom: 0.5rem;
        }
        .team-box {
            padding: 0.75rem; border-radius: 8px; text-align: center;
        }
        .team-box.team1 { background: rgba(59,130,246,0.15); border: 1px solid rgba(59,130,246,0.3); }
        .team-box.team2 { background: rgba(239,68,68,0.15); border: 1px solid rgba(239,68,68,0.3); }
        .team-box h4 { margin: 0 0 0.5rem; font-size: 0.85rem; }
        .team-player {
            display: flex; align-items: center; justify-content: center; gap: 0.4rem;
            font-size: 0.9rem; padding: 4px 8px; border-radius: 6px;
            transition: background 0.15s, transform 0.15s;
        }
        .team-player-movable {
            cursor: pointer;
            background: rgba(255,255,255,0.06);
        }
        .team-player-movable:not(.readonly):hover {
            background: rgba(255,255,255,0.15);
            transform: scale(1.03);
        }
        .team-player-movable.readonly { cursor: default; }
        .team-player-empty {
            font-size: 0.8rem; color: var(--text-muted); font-style: italic;
            padding: 4px 0;
        }
        .move-icon { font-size: 0.7rem; opacity: 0.5; }
        .teams-hint { font-size: 0.75rem; font-weight: normal; opacity: 0.6; }
        .teams-warning {
            text-align: center; font-size: 0.8rem; color: #f59e0b;
            margin-top: 0.5rem; margin-bottom: 0.5rem;
        }
        .team-full { }
        .vs-divider {
            font-weight: bold; font-size: 1.1rem; color: var(--text-muted);
        }

        /* Sets */
        .sets-section { margin-top: 1rem; }
        .sets-grid { display: flex; flex-direction: column; gap: 0.5rem; }
        .set-row {
            display: flex; align-items: center; gap: 0.75rem;
        }
        .set-label { font-size: 0.85rem; color: var(--text-muted); min-width: 50px; }
        .set-score { display: flex; align-items: center; gap: 0.5rem; }
        .score-input {
            width: 52px; text-align: center; font-size: 1.2rem; font-weight: bold;
            padding: 0.4rem; border-radius: 6px;
            border: 1px solid var(--border, #444);
            background: var(--bg-input, #2a2a3e);
            color: var(--text, #fff);
        }
        .team1-score { border-color: rgba(59,130,246,0.5); }
        .team2-score { border-color: rgba(239,68,68,0.5); }
        .score-dash { font-size: 1.2rem; color: var(--text-muted); }
        .btn-remove-set {
            background: none; border: none; color: var(--text-muted);
            cursor: pointer; font-size: 1rem; padding: 4px;
        }
        .add-set-btn { margin-top: 0.5rem; }

        /* Winner */
        .winner-section { margin-top: 1rem; }
        .winner-badge {
            padding: 0.75rem; border-radius: 8px; text-align: center;
            font-weight: bold; font-size: 1rem;
        }
        .team1-winner { background: rgba(59,130,246,0.2); border: 1px solid rgba(59,130,246,0.4); color: #93c5fd; }
        .team2-winner { background: rgba(239,68,68,0.2); border: 1px solid rgba(239,68,68,0.4); color: #fca5a5; }
        .winner-names { font-weight: normal; font-size: 0.85rem; opacity: 0.8; display: block; margin-top: 4px; }

        /* Ranking toggle */
        .ranking-toggle-section { margin-top: 1rem; padding: 0.75rem; background: var(--bg-input, #2a2a3e); border-radius: 8px; }
        .ranking-toggle { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
        .ranking-toggle input[type="checkbox"] { width: 18px; height: 18px; accent-color: var(--primary); }
        .toggle-text { font-size: 0.95rem; }
        .ranking-hint { color: var(--text-muted); display: block; margin-top: 4px; margin-left: 26px; }

        /* Buttons */
        .btn { padding: 0.5rem 1rem; border-radius: 6px; border: none; cursor: pointer; font-size: 0.9rem; }
        .btn-primary { background: var(--primary); color: #fff; }
        .btn-secondary { background: var(--bg-input, #333); color: var(--text); }
        .btn-danger { background: #ef4444; color: #fff; }
        .btn-outline { background: transparent; border: 1px solid var(--border, #444); color: var(--text); }
        .btn-sm { padding: 0.35rem 0.75rem; font-size: 0.8rem; }
        .btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .btn-icon { background: none; border: none; cursor: pointer; }
    `]
})
export class ScoreModalComponent implements OnInit {
    @Input() reservationId!: string;
    @Input() clubId!: string;
    @Input() date!: string;
    @Input() playerNames: string[] = [];
    @Input() playerIds: string[] = [];
    @Input() pointsPerWin = 3;
    @Output() close = new EventEmitter<void>();
    @Output() saved = new EventEmitter<FreePlayMatch>();

    team1Names: string[] = [];
    team2Names: string[] = [];
    team1PlayerIds: string[] = [];
    team2PlayerIds: string[] = [];
    sets: { team1: number; team2: number }[] = [{ team1: 0, team2: 0 }, { team1: 0, team2: 0 }, { team1: 0, team2: 0 }];
    winner: number | null = null;
    countsForRanking = true;
    saving = false;
    matchSaved = false;
    existingMatch: FreePlayMatch | null = null;

    constructor(
        private courtService: CourtService,
        private toast: ToastService,
        private cdr: ChangeDetectorRef
    ) {}

    ngOnInit() {
        // Assign players to teams: 1&2 vs 3&4
        this.team1Names = [this.playerNames[0] || '', this.playerNames[1] || ''];
        this.team2Names = [this.playerNames[2] || '', this.playerNames[3] || ''];
        this.team1PlayerIds = [this.playerIds[0] || '', this.playerIds[1] || ''];
        this.team2PlayerIds = [this.playerIds[2] || '', this.playerIds[3] || ''];

        // Load existing match if any
        this.courtService.getFreePlayMatch(this.reservationId).subscribe({
            next: (match) => {
                if (match) {
                    this.existingMatch = match;
                    this.team1Names = match.team1Names || this.team1Names;
                    this.team2Names = match.team2Names || this.team2Names;
                    this.team1PlayerIds = match.team1PlayerIds || this.team1PlayerIds;
                    this.team2PlayerIds = match.team2PlayerIds || this.team2PlayerIds;
                    this.sets = match.sets?.length ? [...match.sets] : this.sets;
                    this.winner = match.winner || null;
                    this.countsForRanking = match.countsForRanking;
                    this.matchSaved = match.status === 'completed';
                    this.cdr.markForCheck();
                }
            },
            error: () => {} // No existing match, that's fine
        });
    }

    moveToTeam2(index: number) {
        if (this.team1Names.length <= 0) return;
        const name = this.team1Names.splice(index, 1)[0];
        const id = this.team1PlayerIds.splice(index, 1)[0];
        this.team2Names.push(name);
        this.team2PlayerIds.push(id);
        this.cdr.markForCheck();
    }

    moveToTeam1(index: number) {
        if (this.team2Names.length <= 0) return;
        const name = this.team2Names.splice(index, 1)[0];
        const id = this.team2PlayerIds.splice(index, 1)[0];
        this.team1Names.push(name);
        this.team1PlayerIds.push(id);
        this.cdr.markForCheck();
    }

    get teamsBalanced(): boolean {
        return this.team1Names.length === 2 && this.team2Names.length === 2;
    }

    addSet() {
        if (this.sets.length < 5) {
            this.sets.push({ team1: 0, team2: 0 });
            this.cdr.markForCheck();
        }
    }

    removeSet(index: number) {
        this.sets.splice(index, 1);
        this.evaluateWinner();
        this.cdr.markForCheck();
    }

    evaluateWinner() {
        let team1Wins = 0;
        let team2Wins = 0;
        for (const set of this.sets) {
            if (set.team1 > set.team2) team1Wins++;
            else if (set.team2 > set.team1) team2Wins++;
        }
        const majority = Math.ceil(this.sets.length / 2);
        if (team1Wins >= majority) this.winner = 1;
        else if (team2Wins >= majority) this.winner = 2;
        else this.winner = null;
        this.cdr.markForCheck();
    }

    get hasValidScore(): boolean {
        return this.teamsBalanced && this.sets.some(s => s.team1 > 0 || s.team2 > 0);
    }

    saveMatch() {
        this.saving = true;
        this.cdr.markForCheck();
        const data: Partial<FreePlayMatch> = {
            reservationId: this.reservationId,
            clubId: this.clubId,
            date: this.date,
            team1PlayerIds: this.team1PlayerIds.filter(id => id),
            team2PlayerIds: this.team2PlayerIds.filter(id => id),
            team1Names: this.team1Names,
            team2Names: this.team2Names,
            sets: this.sets,
            countsForRanking: this.countsForRanking,
            pointsPerWin: this.pointsPerWin
        };
        this.courtService.saveFreePlayMatch(data).subscribe({
            next: (match) => {
                this.existingMatch = match;
                this.matchSaved = match.status === 'completed';
                this.winner = match.winner || null;
                this.saving = false;
                this.toast.success('Marcador guardado');
                this.saved.emit(match);
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.saving = false;
                this.toast.error(err.error?.message || 'Error al guardar marcador');
                this.cdr.markForCheck();
            }
        });
    }

    deleteMatch() {
        this.saving = true;
        this.cdr.markForCheck();
        this.courtService.deleteFreePlayMatch(this.reservationId).subscribe({
            next: () => {
                this.existingMatch = null;
                this.matchSaved = false;
                this.sets = [{ team1: 0, team2: 0 }, { team1: 0, team2: 0 }, { team1: 0, team2: 0 }];
                this.winner = null;
                this.saving = false;
                this.toast.success('Marcador eliminado');
                this.cdr.markForCheck();
            },
            error: () => {
                this.saving = false;
                this.toast.error('Error al eliminar marcador');
                this.cdr.markForCheck();
            }
        });
    }
}
