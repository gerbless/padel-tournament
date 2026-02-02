import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, FormArray, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { PlayerService, Player } from '../../../../services/player.service';
import { PersonalTrackerService } from '../../../../services/personal-tracker.service';
import { PlayerSelectComponent } from '../../../../components/player-select/player-select.component';

@Component({
    selector: 'app-match-form',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, PlayerSelectComponent],
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

    constructor(
        private fb: FormBuilder,
        private playerService: PlayerService,
        private trackerService: PersonalTrackerService,
        private router: Router
    ) {
        this.form = this.fb.group({
            date: [new Date().toISOString().substring(0, 10), Validators.required],
            partnerId: ['', Validators.required],
            rival1Id: ['', Validators.required],
            rival2Id: ['', Validators.required],
            sets: this.fb.array([this.createSetGroup(1), this.createSetGroup(2)])
        });
    }

    ngOnInit() {
        // Assuming getRanking or findAll exists. PlayerService usually has findAll.
        // I will check PlayerService definition again if getRanking exists. 
        // Based on previous step, it has findAll. 
        // I will use findAll() for now. If I need ranking I'll check if getRanking exists.
        this.playerService.findAll().subscribe((players: Player[]) => {
            this.players = players;
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
        this.sets.removeAt(index);
    }

    onSubmit() {
        if (this.form.invalid) return;

        this.loading = true;
        this.trackerService.createMatch(this.form.value).subscribe({
            next: () => {
                this.router.navigate(['/personal-tracker']);
            },
            error: (err: any) => {
                console.error(err);
                this.loading = false;
            }
        });
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
