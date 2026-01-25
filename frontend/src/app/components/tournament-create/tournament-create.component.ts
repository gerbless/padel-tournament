import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TournamentService } from '../../services/tournament.service';
import { PlayerService, Player } from '../../services/player.service';

@Component({
    selector: 'app-tournament-create',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
    templateUrl: './tournament-create.component.html',
    styleUrls: ['./tournament-create.component.css']
})
export class TournamentCreateComponent {
    tournamentForm: FormGroup;
    submitting = false;
    existingPlayers: Player[] = [];

    constructor(
        private fb: FormBuilder,
        private tournamentService: TournamentService,
        private playerService: PlayerService,
        private router: Router
    ) {
        this.tournamentForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(3)]],
            type: ['cuadrangular', Validators.required],
            teams: this.fb.array([])
        });

        this.loadPlayers();

        // Initialize with 4 teams for cuadrangular
        this.onTypeChange();
    }

    loadPlayers() {
        this.playerService.findAll().subscribe({
            next: (players) => this.existingPlayers = players,
            error: (err) => console.error('Error loading players for autocomplete:', err)
        });
    }

    get teams(): FormArray {
        return this.tournamentForm.get('teams') as FormArray;
    }

    onTypeChange() {
        const type = this.tournamentForm.get('type')?.value;
        const teamCount = type === 'cuadrangular' ? 4 : 6;

        // Clear existing teams
        while (this.teams.length > 0) {
            this.teams.removeAt(0);
        }

        // Add new teams
        for (let i = 0; i < teamCount; i++) {
            this.teams.push(this.fb.group({
                player1Name: ['', Validators.required],
                player2Name: ['', Validators.required]
            }));
        }
    }

    onSubmit() {
        if (this.tournamentForm.invalid) {
            Object.keys(this.tournamentForm.controls).forEach(key => {
                this.tournamentForm.get(key)?.markAsTouched();
            });
            return;
        }

        this.submitting = true;
        this.tournamentService.createTournament(this.tournamentForm.value).subscribe({
            next: (tournament: any) => {
                this.router.navigate(['/tournaments', tournament.id]);
            },
            error: (error: any) => {
                console.error('Error creating tournament:', error);
                alert('Error al crear el torneo: ' + (error.error?.message || 'Error desconocido'));
                this.submitting = false;
            }
        });
    }
}
