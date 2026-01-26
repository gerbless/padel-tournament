import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule, FormBuilder, FormGroup, Validators, FormArray } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { LeagueService } from '../../services/league.service';
import { PlayerService, Player } from '../../services/player.service';

@Component({
    selector: 'app-league-create',
    standalone: true,
    imports: [CommonModule, FormsModule, ReactiveFormsModule, RouterModule],
    templateUrl: './league-create.component.html',
    styleUrls: ['./league-create.component.css']
})
export class LeagueCreateComponent implements OnInit {
    leagueForm: FormGroup;
    players: Player[] = [];
    filteredPlayers: Player[] = []; // For autocomplete potentially, but simple select for now

    constructor(
        private fb: FormBuilder,
        private leagueService: LeagueService,
        private playerService: PlayerService,
        private router: Router
    ) {
        this.leagueForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(3)]],
            type: ['round_robin', Validators.required],
            config: this.fb.group({
                pointsForWin: [3, [Validators.required, Validators.min(0)]],
                pointsForLoss: [1, [Validators.required, Validators.min(0)]],
                rounds: [1, [Validators.required, Validators.min(1)]]
            }),
            // We will handle teams separately or in a second step for simplicity?
            // Let's try to add at least a few teams here or redirect to a team management page.
            // Ideally wizard style.
        });
    }

    ngOnInit(): void {
        // Load players if we want to allow selecting them, but maybe Create -> Redirect to Dashboard -> Add Teams is better MVP flow.
        // Let's stick to Create Basic Info -> Redirect to Dashboard.
    }

    onSubmit(): void {
        if (this.leagueForm.valid) {
            const formValue = this.leagueForm.value;
            this.leagueService.createLeague(formValue).subscribe({
                next: (league) => {
                    this.router.navigate(['/leagues', league.id]);
                },
                error: (err) => {
                    console.error('Error creating league', err);
                    alert('Error creando la liga');
                }
            });
        }
    }
}
