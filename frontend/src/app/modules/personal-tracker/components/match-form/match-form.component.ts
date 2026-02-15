import { Component, OnInit, DestroyRef, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PlayerService, Player } from '../../../../services/player.service';
import { PersonalTrackerService } from '../../../../services/personal-tracker.service';
import { PlayerSelectComponent } from '../../../../components/player-select/player-select.component';
import { ToastService } from '../../../../services/toast.service';

@Component({
    selector: 'app-match-form',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, PlayerSelectComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './match-form.component.html',
    styles: [`
        .form-container {
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            background: var(--bg-secondary);
            border-radius: 1rem;
            border: 1px solid var(--border);
        }
        
        h2 { margin-bottom: 2rem; }
        
        .form-group { margin-bottom: 1.5rem; }
        label { display: block; margin-bottom: 0.5rem; color: var(--text-secondary); }
        select, input {
            width: 100%;
            padding: 0.75rem;
            border-radius: 0.5rem;
            background: var(--bg-tertiary);
            border: 1px solid var(--border);
            color: white;
        }

        .sets-container {
            display: grid;
            gap: 1rem;
            margin-bottom: 2rem;
        }

        .set-row {
            display: grid;
            grid-template-columns: 100px 1fr 1fr auto;
            gap: 1rem;
            align-items: center;
            background: rgba(255,255,255,0.05);
            padding: 1rem;
            border-radius: 0.5rem;
        }

        .actions {
            display: flex;
            justify-content: flex-end;
            gap: 1rem;
            margin-top: 2rem;
        }

        .btn-cancel {
            background: transparent;
            border: 1px solid var(--border);
            color: var(--text-muted);
            padding: 0.75rem 1.5rem;
            border-radius: 0.5rem;
            cursor: pointer;
        }

        .btn-submit {
            background: var(--primary);
            color: white;
            border: none;
            padding: 0.75rem 2rem;
            border-radius: 0.5rem;
            font-weight: 600;
            cursor: pointer;
        }
    `]
})
export class MatchFormComponent implements OnInit {
    form: FormGroup;
    players: Player[] = [];
    loading = false;
    matchId: string | null = null;
    isEditMode = false;

    private destroyRef = inject(DestroyRef);

    private cdr = inject(ChangeDetectorRef);

    constructor(
        private fb: FormBuilder,
        private playerService: PlayerService,
        private trackerService: PersonalTrackerService,
        private router: Router,
        private route: ActivatedRoute,
        private toast: ToastService
    ) {
        this.form = this.fb.group({
            date: [new Date().toISOString().substring(0, 10), Validators.required],
            partnerId: ['', Validators.required],
            rival1Id: ['', Validators.required],
            rival2Id: ['', Validators.required],
            sets: this.fb.array([])
        });
    }

    ngOnInit() {
        // Check if we're editing an existing match
        this.route.params.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(params => {
            this.matchId = params['id'] || null;
            if (this.matchId) {
                this.isEditMode = true;
                this.loadMatch();
            } else {
                // Create default sets for new match
                this.addSet();
                this.addSet();
            }
            this.cdr.markForCheck();
        });

        this.playerService.findAll().pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe((players: Player[]) => {
            this.players = players;
            this.cdr.markForCheck();
        });
    }

    loadMatch() {
        if (!this.matchId) return;

        this.loading = true;
        this.trackerService.getMatch(this.matchId).subscribe({
            next: (match) => {
                this.form.patchValue({
                    date: new Date(match.date).toISOString().substring(0, 10),
                    partnerId: match.partnerId,
                    rival1Id: match.rival1Id,
                    rival2Id: match.rival2Id
                });

                // Load sets
                this.sets.clear();
                if (match.sets && match.sets.length > 0) {
                    match.sets.forEach((set, index) => {
                        const setGroup = this.createSetGroup(index + 1);
                        setGroup.patchValue(set);
                        this.sets.push(setGroup);
                    });
                } else {
                    // No sets yet, add default ones
                    this.addSet();
                    this.addSet();
                }

                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (err: any) => {
                console.error(err);
                this.loading = false;
                this.cdr.markForCheck();
                this.router.navigate(['/personal-tracker']);
            }
        });
    }

    createSetGroup(setNum: number): FormGroup {
        return this.fb.group({
            set: [setNum],
            myScore: [0, [Validators.required, Validators.min(0)]],
            rivalScore: [0, [Validators.required, Validators.min(0)]],
            tieBreak: [false]
        });
    }

    get sets() {
        return this.form.get('sets') as FormArray;
    }

    addSet() {
        if (this.sets.length < 3) {
            this.sets.push(this.createSetGroup(this.sets.length + 1));
        }
    }

    removeSet(index: number) {
        if (this.sets.length > 1) {
            this.sets.removeAt(index);
            // Re-number remaining sets
            this.sets.controls.forEach((control, i) => {
                control.patchValue({ set: i + 1 });
            });
        }
    }

    saveDraft() {
        if (this.form.get('partnerId')?.invalid ||
            this.form.get('rival1Id')?.invalid ||
            this.form.get('rival2Id')?.invalid) {
            return;
        }

        this.loading = true;
        const matchData = {
            ...this.form.value,
            status: 'draft',
            sets: []
        };

        if (this.isEditMode && this.matchId) {
            this.trackerService.updateMatch(this.matchId, matchData).subscribe({
                next: () => { this.toast.success('Borrador guardado'); this.router.navigate(['/personal-tracker']); },
                error: () => { this.toast.error('Error al guardar borrador'); this.loading = false; }
            });
        } else {
            this.trackerService.createMatch(matchData).subscribe({
                next: () => { this.toast.success('Borrador creado'); this.router.navigate(['/personal-tracker']); },
                error: () => { this.toast.error('Error al crear borrador'); this.loading = false; }
            });
        }
    }

    saveInProgress() {
        if (this.form.invalid) return;

        this.loading = true;
        const matchData = {
            ...this.form.value,
            status: 'in_progress'
        };

        if (this.isEditMode && this.matchId) {
            this.trackerService.updateMatch(this.matchId, matchData).subscribe({
                next: () => { this.toast.success('Partido guardado'); this.router.navigate(['/personal-tracker']); },
                error: () => { this.toast.error('Error al guardar partido'); this.loading = false; }
            });
        } else {
            this.trackerService.createMatch(matchData).subscribe({
                next: () => { this.toast.success('Partido creado'); this.router.navigate(['/personal-tracker']); },
                error: () => { this.toast.error('Error al crear partido'); this.loading = false; }
            });
        }
    }

    completeMatch() {
        if (this.form.invalid) return;

        this.loading = true;
        const matchData = {
            ...this.form.value,
            status: 'completed'
        };

        if (this.isEditMode && this.matchId) {
            this.trackerService.updateMatch(this.matchId, matchData).subscribe({
                next: () => { this.toast.success('Partido completado'); this.router.navigate(['/personal-tracker']); },
                error: () => { this.toast.error('Error al completar partido'); this.loading = false; }
            });
        } else {
            this.trackerService.createMatch(matchData).subscribe({
                next: () => { this.toast.success('Partido registrado'); this.router.navigate(['/personal-tracker']); },
                error: () => { this.toast.error('Error al registrar partido'); this.loading = false; }
            });
        }
    }

    getExcludedIds(): string[] {
        const ids: string[] = [];
        const formValues = this.form.value;

        if (formValues.partnerId) ids.push(formValues.partnerId);
        if (formValues.rival1Id) ids.push(formValues.rival1Id);
        if (formValues.rival2Id) ids.push(formValues.rival2Id);

        return ids;
    }

    cancel() {
        this.router.navigate(['/personal-tracker']);
    }
}
