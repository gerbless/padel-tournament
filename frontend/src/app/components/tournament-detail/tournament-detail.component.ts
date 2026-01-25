import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { TournamentService, Tournament, Match, Standing } from '../../services/tournament.service';
import { MatchService } from '../../services/match.service';

@Component({
    selector: 'app-tournament-detail',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink],
    templateUrl: './tournament-detail.component.html',
    styleUrls: ['./tournament-detail.component.css']
})
export class TournamentDetailComponent implements OnInit {
    tournament: Tournament | null = null;
    standings: Standing[] = [];
    loading = true;
    selectedMatch: Match | null = null;
    scoreForm: FormGroup;

    constructor(
        private route: ActivatedRoute,
        private tournamentService: TournamentService,
        private matchService: MatchService,
        private fb: FormBuilder
    ) {
        this.scoreForm = this.fb.group({
            sets: this.fb.array([])
        });
    }

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.loadTournament(id);
        }
    }

    loadTournament(id: string) {
        this.loading = true;
        this.tournamentService.getTournament(id).subscribe({
            next: (tournament) => {
                this.tournament = tournament;
                this.loadStandings(id);
            },
            error: (error) => {
                console.error('Error loading tournament:', error);
                this.loading = false;
            }
        });
    }

    loadStandings(id: string) {
        this.tournamentService.getStandings(id).subscribe({
            next: (standings) => {
                this.standings = standings;
                this.loading = false;
            },
            error: (error) => {
                console.error('Error loading standings:', error);
                this.loading = false;
            }
        });
    }

    get sets(): FormArray {
        return this.scoreForm.get('sets') as FormArray;
    }

    openMatchScoreModal(match: Match) {
        this.selectedMatch = match;

        // Clear existing sets
        while (this.sets.length > 0) {
            this.sets.removeAt(0);
        }

        // If match has existing sets, populate form
        if (match.sets && match.sets.length > 0) {
            match.sets.forEach(set => {
                this.sets.push(this.fb.group({
                    team1Games: [set.team1Games ?? 0, [Validators.required, Validators.min(0)]],
                    team2Games: [set.team2Games ?? 0, [Validators.required, Validators.min(0)]],
                }));
            });
        } else {
            // Otherwise, add one empty set
            this.addSet();
        }
    }

    closeModal() {
        this.selectedMatch = null;
    }

    addSet() {
        if (this.sets.length < 3) {
            this.sets.push(this.fb.group({
                team1Games: ['', [Validators.required, Validators.min(0)]],
                team2Games: ['', [Validators.required, Validators.min(0)]],
            }));
        }
    }

    removeSet(index: number) {
        if (this.sets.length > 1) {
            this.sets.removeAt(index);
        }
    }

    saveScore() {
        if (!this.selectedMatch || this.scoreForm.invalid) {
            return;
        }

        // Explicitly cast to numbers to ensure backend compatibility
        const formValue = this.scoreForm.value;
        const processedSets = formValue.sets.map((set: any) => ({
            ...set,
            team1Games: Number(set.team1Games),
            team2Games: Number(set.team2Games),
            tiebreak: set.tiebreak ? {
                team1Points: Number(set.tiebreak.team1Points),
                team2Points: Number(set.tiebreak.team2Points)
            } : undefined
        }));

        const payload = { sets: processedSets };

        this.matchService.updateMatchScore(this.selectedMatch.id, payload).subscribe({
            next: () => {
                if (this.tournament) {
                    this.loadTournament(this.tournament.id);
                }
                this.closeModal();
            },
            error: (error) => {
                console.error('Error updating score:', error);
                alert('Error al actualizar el resultado: ' + (error.error?.message || 'Error desconocido'));
            }
        });
    }

    getMatchDisplay(match: Match): string {
        if (!match.sets || match.sets.length === 0) {
            return 'Pendiente';
        }

        return match.sets.map(set => `${set.team1Games ?? 0}-${set.team2Games ?? 0}`).join(', ');
    }

    getMatchWinnerClass(match: Match, teamId: string): string {
        if (match.winnerId === teamId) {
            return 'match-winner';
        }
        return '';
    }

    getTeamPairName(teamId: string): string {
        const team = this.tournament?.teams.find(t => t.id === teamId);
        if (!team) return 'Desconocido';
        return `${team.player1?.name} & ${team.player2?.name}`;
    }

    canCloseTournament(): boolean {
        if (!this.tournament || this.tournament.status === 'completed') return false;

        return this.tournament.matches.every(
            match => match.sets && match.sets.length > 0
        );
    }

    closeTournament() {
        if (!this.tournament || !this.canCloseTournament()) return;

        if (confirm('¿Estás seguro de finalizar el torneo? No se podrán modificar más resultados.')) {
            this.tournamentService.closeTournament(this.tournament.id).subscribe({
                next: (updatedTournament) => {
                    this.tournament = updatedTournament;
                    alert('¡Torneo finalizado con éxito!');
                },
                error: (error) => {
                    console.error('Error closing tournament:', error);
                    alert('Error al finalizar el torneo: ' + (error.error?.message || 'Error desconocido'));
                }
            });
        }
    }
}
