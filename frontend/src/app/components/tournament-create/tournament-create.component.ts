import { Component, OnInit, OnDestroy } from '@angular/core';
import { PlayerSelectComponent } from '../player-select/player-select.component';
import { PlayerCreateModalComponent } from '../player-create-modal/player-create-modal.component';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TournamentService } from '../../services/tournament.service';
import { PlayerService, Player } from '../../services/player.service';
import { ClubService } from '../../services/club.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-tournament-create',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink, PlayerSelectComponent, PlayerCreateModalComponent],
    templateUrl: './tournament-create.component.html',
    styleUrls: ['./tournament-create.component.css']
})
export class TournamentCreateComponent implements OnInit, OnDestroy {
    tournamentForm: FormGroup;
    submitting = false;
    existingPlayers: Player[] = [];
    currentClubId: string | null = null;
    currentClubName: string = '';
    private clubSubscription?: Subscription;

    constructor(
        private fb: FormBuilder,
        private tournamentService: TournamentService,
        private playerService: PlayerService,
        private router: Router,
        private clubService: ClubService
    ) {
        this.tournamentForm = this.fb.group({
            name: ['', [Validators.required, Validators.minLength(3)]],
            type: ['cuadrangular', Validators.required],
            teams: this.fb.array([])
        });
    }

    ngOnInit() {
        // Subscribe to selected club
        this.clubSubscription = this.clubService.selectedClub$.subscribe(club => {
            this.currentClubId = club?.id || null;
            this.currentClubName = club?.name || 'Sin club';
        });

        this.loadPlayers();
        // Initialize with 4 teams for cuadrangular
        this.onTypeChange();
    }

    ngOnDestroy() {
        this.clubSubscription?.unsubscribe();
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

    getSelectedPlayerNames(currentControlName: string, currentTeamIndex: number): string[] {
        const names: string[] = [];
        this.teams.controls.forEach((group, index) => {
            const p1 = group.get('player1Name')?.value;
            const p2 = group.get('player2Name')?.value;

            // Add names from OTHER teams
            if (index !== currentTeamIndex) {
                if (p1) names.push(p1);
                if (p2) names.push(p2);
            } else {
                // Determine if we are p1 or p2 in CURRENT team
                // If I am p1, exclude p2. If I am p2, exclude p1.
                if (currentControlName === 'player1Name' && p2) names.push(p2);
                if (currentControlName === 'player2Name' && p1) names.push(p1);
            }
        });
        return names;
    }

    // Modal State
    showCreateModal = false;
    createModalInitialName = '';
    private activePlayerSelect: PlayerSelectComponent | null = null;

    openCreateModal(name: string, selectComponent: PlayerSelectComponent) {
        this.createModalInitialName = name;
        this.activePlayerSelect = selectComponent;
        this.showCreateModal = true;
    }

    onPlayerCreated(player: Player) {
        if (this.activePlayerSelect) {
            this.activePlayerSelect.onPlayerCreated(player);
        }
        // Optionally refresh global list if we used it for something else
        this.loadPlayers();
        this.closeCreateModal();
    }

    closeCreateModal() {
        this.showCreateModal = false;
        this.activePlayerSelect = null;
    }

    onSubmit() {
        if (this.tournamentForm.invalid) {
            Object.keys(this.tournamentForm.controls).forEach(key => {
                this.tournamentForm.get(key)?.markAsTouched();
            });
            return;
        }

        this.submitting = true;
        const formData = {
            ...this.tournamentForm.value,
            clubId: this.currentClubId || null  // Include current club or null
        };
        this.tournamentService.createTournament(formData).subscribe({
            next: (tournament: any) => {
                this.router.navigate(['/tournaments', tournament.id]);
            },
            error: (error: any) => {
                console.error('Error creating tournament:', error);
                // Try to extract a specific message if available
                const msg = error.error?.message || error.message || 'Error desconocido';
                alert('Error al crear el torneo: ' + (Array.isArray(msg) ? msg.join(', ') : msg));
                this.submitting = false;
            }
        });
    }
}
