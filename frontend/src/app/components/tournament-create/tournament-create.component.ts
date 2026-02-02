import { Component, OnInit, OnDestroy } from '@angular/core';
import { PlayerSelectComponent } from '../player-select/player-select.component';
import { PlayerCreateModalComponent } from '../player-create-modal/player-create-modal.component';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule, AbstractControl } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { TournamentService } from '../../services/tournament.service';
import { PlayerService, Player } from '../../services/player.service';
import { ClubService } from '../../services/club.service';
import { Club } from '../../models/club.model';
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
            config: this.fb.group({
                strictScoring: [false], // Defaults to flexible as per user preference
                allowTies: [true]       // Defaults to allowing ties
            }),
            teams: this.fb.array([])
        });
    }

    ngOnInit() {
        // Subscribe to selected club
        this.clubSubscription = this.clubService.selectedClub$.subscribe((club: Club | null) => {
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
            next: (players: Player[]) => this.existingPlayers = players,
            error: (err: any) => console.error('Error loading players for autocomplete:', err)
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
        this.teams.controls.forEach((group: AbstractControl, index: number) => {
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

    // ... existing code ...

    autoGenerateTeams() {
        const type = this.tournamentForm.get('type')?.value;
        const requiredTeams = type === 'cuadrangular' ? 4 : 6;
        const requiredPlayers = requiredTeams * 2;

        let availablePlayers = [...this.existingPlayers];

        // Filter by club if needed
        if (this.currentClubId) {
            availablePlayers = availablePlayers.filter(p => p.clubs?.some(c => c.id === this.currentClubId));
        }

        if (availablePlayers.length < requiredPlayers) {
            alert(`No hay suficientes jugadores disponibles en el club para generar ${requiredTeams} parejas. Se necesitan ${requiredPlayers} y hay ${availablePlayers.length}.`);
            return;
        }

        // Try to generate valid pairings
        let success = false;
        let attempts = 0;
        let finalPairs: Player[][] = [];

        while (!success && attempts < 50) {
            attempts++;
            // Shuffle players
            const shuffled = availablePlayers.sort(() => 0.5 - Math.random());
            const candidates = [...shuffled];
            const currentPairs: Player[][] = [];
            let possible = true;

            for (let i = 0; i < requiredTeams; i++) {
                // Pick player 1
                const p1 = candidates.pop();
                if (!p1) { possible = false; break; }

                // Find compatible partner
                const p2Index = candidates.findIndex(p => this.areCompatible(p1, p));

                if (p2Index === -1) {
                    possible = false;
                    break;
                }

                const p2 = candidates.splice(p2Index, 1)[0];
                currentPairs.push([p1, p2]);
            }

            if (possible) {
                finalPairs = currentPairs;
                success = true;
            }
        }

        if (success) {
            // Apply to form
            // Ensure we have correct number of teams in form
            this.onTypeChange();

            finalPairs.forEach((pair, index) => {
                const group = this.teams.at(index);
                if (group) {
                    group.patchValue({
                        player1Name: pair[0].name,
                        player2Name: pair[1].name
                    });
                }
            });
        } else {
            alert('No se pudieron generar parejas válidas con los jugadores disponibles que cumplan las reglas de posición (Revés/Drive/Mixto). Intenta agregar más jugadores.');
        }
    }

    private areCompatible(p1: Player, p2: Player): boolean {
        // Normalize positions (assume lowercase)
        const pos1 = p1.position?.toLowerCase() || 'mixto'; // Default to mixto if undefined? Or maybe strict? Let's be lenient.
        const pos2 = p2.position?.toLowerCase() || 'mixto';

        // Reves cannot play with Reves
        if (pos1 === 'reves' && pos2 === 'reves') return false;

        // Drive cannot play with Drive
        if (pos1 === 'drive' && pos2 === 'drive') return false;

        // All other combinations are valid:
        // Reves + Drive (OK)
        // Reves + Mixto (OK)
        // Drive + Mixto (OK)
        // Mixto + Mixto (OK)
        return true;
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
