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
    errorMessage: string | null = null;

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
        if (this.tournament?.status === 'completed') {
            this.errorMessage = 'El torneo está finalizado. No se pueden modificar los resultados.';
            return;
        }

        this.selectedMatch = match;
        this.errorMessage = null;

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
                    tiebreakTeam1: [set.tiebreak?.team1Points ?? '', []],
                    tiebreakTeam2: [set.tiebreak?.team2Points ?? '', []]
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
                tiebreakTeam1: ['', []],
                tiebreakTeam2: ['', []]
            }));
        }
    }

    removeSet(index: number) {
        if (this.sets.length > 1) {
            this.sets.removeAt(index);
        }
    }

    isTieBreakNeeded(index: number): boolean {
        const set = this.sets.at(index);
        const g1 = set.get('team1Games')?.value;
        const g2 = set.get('team2Games')?.value;
        // Tie-break needed if 6-6, 7-6, 6-7
        return (g1 == 6 && g2 == 6) || (g1 == 7 && g2 == 6) || (g1 == 6 && g2 == 7);
    }

    saveScore() {
        this.errorMessage = null;
        if (!this.selectedMatch || this.scoreForm.invalid) {
            this.errorMessage = 'Por favor completa todos los campos requeridos correctamente.';
            return;
        }

        // Check validation for tie-breaks
        const formValue = this.scoreForm.value;
        const processedSets: any[] = [];

        for (let i = 0; i < formValue.sets.length; i++) {
            const set = formValue.sets[i];
            const g1 = Number(set.team1Games);
            const g2 = Number(set.team2Games);

            const setPayload: any = {
                team1Games: g1,
                team2Games: g2
            };

            // Validate tie-break
            if (this.isTieBreakNeeded(i)) {
                if (set.tiebreakTeam1 === '' || set.tiebreakTeam2 === '' || set.tiebreakTeam1 === null || set.tiebreakTeam2 === null) {
                    this.errorMessage = `El Set ${i + 1} requiere puntos de Tie-break (ej. 7-4)`;
                    return;
                }
                setPayload.tiebreak = {
                    team1Points: Number(set.tiebreakTeam1),
                    team2Points: Number(set.tiebreakTeam2)
                };
            }

            processedSets.push(setPayload);
        }

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
                this.errorMessage = 'Error al actualizar: ' + (error.error?.message || 'Error desconocido');
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

    showCloseModal = false;

    confirmCloseTournament() {
        if (!this.tournament) return;

        // Validation check
        const incompleteMatches = this.tournament.matches.filter(m => !m.sets || m.sets.length === 0);
        if (incompleteMatches.length > 0) {
            this.errorMessage = `No se puede finalizar: Hay ${incompleteMatches.length} partidos pendientes.`;
            return;
        }

        this.showCloseModal = true;
    }

    cancelCloseTournament() {
        this.showCloseModal = false;
    }

    finalizeTournament() {
        if (!this.tournament) return;

        this.tournamentService.closeTournament(this.tournament.id).subscribe({
            next: (updatedTournament) => {
                this.tournament = updatedTournament;
                this.errorMessage = null;
                this.showCloseModal = false;
                // Optional: Scroll to top to show status change or show a success banner
            },
            error: (error) => {
                console.error('Error closing tournament:', error);
                this.errorMessage = 'Error al finalizar el torneo: ' + (error.error?.message || 'Error desconocido');
                // Keep modal open to show error
            }
        });
    }
}
