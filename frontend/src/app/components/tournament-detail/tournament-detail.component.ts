import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormBuilder, FormGroup, FormArray, ReactiveFormsModule, Validators } from '@angular/forms';
import { TournamentService, Tournament, Match, Standing } from '../../services/tournament.service';
import { MatchService } from '../../services/match.service';
import { ToastService } from '../../services/toast.service';
import { AuthService } from '../../services/auth.service';
import { TournamentBracketComponent } from '../tournament-bracket/tournament-bracket.component';

@Component({
    selector: 'app-tournament-detail',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, RouterLink, TournamentBracketComponent],
    templateUrl: './tournament-detail.component.html',
    styleUrls: ['./tournament-detail.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TournamentDetailComponent implements OnInit {
    tournament: Tournament | null = null;
    /** General standings (all phases: group + elimination) */
    standings: Standing[] = [];
    /** Group-only standings (only group phase matches) */
    groupOnlyStandings: Standing[] = [];
    loading = true;
    selectedMatch: Match | null = null;
    scoreForm: FormGroup;
    errorMessage: string | null = null;
    isLoggedIn = false;
    canEdit = false;
    canAdmin = false;

    // Group/phase view
    activeMainTab: 'matches' | 'bracket' = 'matches';
    activeGroupTab: number = 0; // 0 = All, 1..N = group number
    activeRoundTab: number = 0; // 0 = All rounds, 1..N = specific round
    standingsByGroup: Map<number, Standing[]> = new Map();

    constructor(
        private route: ActivatedRoute,
        private tournamentService: TournamentService,
        private matchService: MatchService,
        private fb: FormBuilder,
        private cdr: ChangeDetectorRef,
        private toast: ToastService,
        private authService: AuthService
    ) {
        this.scoreForm = this.fb.group({
            sets: this.fb.array([])
        });
    }

    ngOnInit() {
        this.isLoggedIn = this.authService.isAuthenticated();
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.loadTournament(id);
        }
    }

    private updatePermissions() {
        if (this.tournament?.clubId) {
            this.canEdit = this.authService.hasClubRole(this.tournament.clubId, 'editor');
            this.canAdmin = this.authService.hasClubRole(this.tournament.clubId, 'admin');
        } else {
            this.canEdit = false;
            this.canAdmin = false;
        }
    }

    loadTournament(id: string) {
        this.loading = true;
        this.tournamentService.getTournament(id).subscribe({
            next: (tournament) => {
                this.tournament = tournament;
                this.updatePermissions();
                this.loadStandings(id);
                this.cdr.markForCheck();
            },
            error: (error) => {
                console.error('Error loading tournament:', error);
                this.loading = false;
                this.cdr.markForCheck();
            }
        });
    }

    loadStandings(id: string) {
        // General standings (all phases)
        this.tournamentService.getStandings(id).subscribe({
            next: (standings) => {
                this.standings = standings;
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (error) => {
                console.error('Error loading standings:', error);
                this.loading = false;
                this.cdr.markForCheck();
            }
        });
        // Group-phase-only standings (for per-group tables)
        this.tournamentService.getStandings(id, undefined, 'group').subscribe({
            next: (standings) => {
                this.groupOnlyStandings = standings;
                this.buildStandingsByGroup(standings);
                this.cdr.markForCheck();
            },
            error: () => { /* fallback: use general standings for groups */ }
        });
    }

    private buildStandingsByGroup(standings: Standing[]) {
        this.standingsByGroup.clear();
        standings.forEach(s => {
            const g = s.groupNumber || 1;
            if (!this.standingsByGroup.has(g)) {
                this.standingsByGroup.set(g, []);
            }
            this.standingsByGroup.get(g)!.push(s);
        });
    }

    // ===== Group/Round/Phase helpers =====
    get hasGroups(): boolean {
        return (this.tournament?.totalGroups || 1) > 1;
    }

    get groupNumbers(): number[] {
        const total = this.tournament?.totalGroups || 1;
        return Array.from({ length: total }, (_, i) => i + 1);
    }

    get totalRounds(): number {
        if (!this.tournament) return 0;
        const rounds = this.tournament.matches
            .filter(m => m.phase === 'group')
            .map(m => m.round || 0);
        return rounds.length > 0 ? Math.max(...rounds) : 0;
    }

    get roundNumbers(): number[] {
        return Array.from({ length: this.totalRounds }, (_, i) => i + 1);
    }

    getMatchesForView(): Match[] {
        if (!this.tournament) return [];
        let matches = this.tournament.matches;
        if (this.activeGroupTab > 0) {
            matches = matches.filter(m => m.round === this.activeGroupTab);
        }
        // Sort by round then by court
        return matches.sort((a, b) => {
            const phaseOrder = (p: string | undefined) => p === 'elimination' ? 1 : 0;
            const diff = phaseOrder(a.phase) - phaseOrder(b.phase);
            if (diff !== 0) return diff;
            const roundDiff = (a.round || 0) - (b.round || 0);
            if (roundDiff !== 0) return roundDiff;
            return (a.courtNumber || 0) - (b.courtNumber || 0);
        });
    }

    getGroupPhaseMatches(): Match[] {
        return this.tournament?.matches.filter(m => m.phase === 'group') || [];
    }

    getEliminationMatches(): Match[] {
        return this.tournament?.matches.filter(m => m.phase === 'elimination') || [];
    }

    setActiveGroup(g: number): void {
        this.activeGroupTab = g;
        this.activeRoundTab = 0; // reset round filter when switching groups
    }

    getRoundsForGroup(groupNumber: number): number[] {
        if (!this.tournament) return [];
        const rounds = new Set<number>();
        for (const m of this.tournament.matches) {
            if (m.phase === 'group' && m.groupNumber === groupNumber && m.round) {
                rounds.add(m.round);
            }
        }
        return Array.from(rounds).sort((a, b) => a - b);
    }

    get activeGroupRounds(): number[] {
        if (!this.hasGroups || this.activeGroupTab === 0) return [];
        return this.getRoundsForGroup(this.activeGroupTab);
    }

    isMatchHidden(match: Match): boolean {
        if (this.hasGroups) {
            // Filter by group
            if (this.activeGroupTab > 0 && match.groupNumber !== this.activeGroupTab) return true;
            // Filter by round within the group
            if (this.activeRoundTab > 0 && match.round !== this.activeRoundTab) return true;
            return false;
        }
        // Single group: filter by round
        if (this.activeGroupTab === 0) return false;
        return match.round !== this.activeGroupTab;
    }

    getStandingsForGroup(groupNumber: number): Standing[] {
        return this.groupOnlyStandings.filter(s => s.groupNumber === groupNumber);
    }

    get allGroupMatchesCompleted(): boolean {
        const groupMatches = this.getGroupPhaseMatches();
        return groupMatches.length > 0 && groupMatches.every(m => m.sets && m.sets.length > 0);
    }

    get hasEliminationMatches(): boolean {
        return this.getEliminationMatches().length > 0;
    }

    get isFreeModeWithGroups(): boolean {
        return this.tournament?.durationMode === 'free' && (this.tournament?.totalGroups || 1) >= 1;
    }

    get semiFinalMatches(): Match[] {
        return this.getEliminationMatches().filter(m => m.round === 1);
    }

    get finalMatch(): Match | null {
        return this.getEliminationMatches().find(m => m.round === 2) || null;
    }

    get allSemiFinalsCompleted(): boolean {
        const semis = this.semiFinalMatches;
        return semis.length === 2 && semis.every(m => m.status === 'completed' && m.winnerId);
    }

    get canGenerateFinal(): boolean {
        return this.allSemiFinalsCompleted && !this.finalMatch && this.tournament?.status !== 'completed';
    }

    getEliminationLabel(match: Match): string {
        if (match.round === 2) return '🏆 Final';
        return '⚔️ Semifinal';
    }

    /** How far a team reached in elimination: 'Campeón', 'Finalista', 'Semifinal', or '' */
    getEliminationBadge(teamId: string): string {
        const elimMatches = this.getEliminationMatches().filter(
            m => m.status === 'completed' && (m.team1Id === teamId || m.team2Id === teamId)
        );
        if (elimMatches.length === 0) return '';

        const finalM = elimMatches.find(m => m.round === 2);
        if (finalM) {
            return finalM.winnerId === teamId ? '🏆 Campeón' : '🥈 Finalista';
        }
        const semiM = elimMatches.find(m => m.round === 1);
        if (semiM) {
            return semiM.winnerId === teamId ? '✅ Semi' : '❌ Semi';
        }
        return '';
    }

    /** Whether to show a final pending badge (team in semi but no final yet) */
    getEliminationPendingBadge(teamId: string): string {
        const semis = this.semiFinalMatches;
        const inSemi = semis.some(m => m.team1Id === teamId || m.team2Id === teamId);
        if (!inSemi) return '';
        const completedSemi = semis.find(
            m => m.status === 'completed' && (m.team1Id === teamId || m.team2Id === teamId)
        );
        if (!completedSemi) return '⏳ Semifinal';
        if (completedSemi.winnerId !== teamId) return '';
        // Winner of semi — check if final exists
        if (!this.finalMatch) return '⏳ Final';
        if (this.finalMatch.status !== 'completed') return '⏳ Final';
        return '';
    }

    generateElimination() {
        if (!this.tournament) return;
        this.tournamentService.generateElimination(this.tournament.id).subscribe({
            next: () => {
                this.toast.success('¡Partidos de eliminación generados!');
                this.loadTournament(this.tournament!.id);
            },
            error: (err) => {
                const msg = err.error?.message || 'Error al generar eliminación';
                this.toast.error(msg);
                this.cdr.markForCheck();
            }
        });
    }

    // ===== Existing methods =====
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

        while (this.sets.length > 0) {
            this.sets.removeAt(0);
        }

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

        const isStandardTieBreak = (g1 == 6 && g2 == 6) || (g1 == 7 && g2 == 6) || (g1 == 6 && g2 == 7);

        if (this.tournament?.config?.strictScoring === false && g1 == 6 && g2 == 6) {
            return false;
        }

        return isStandardTieBreak;
    }

    saveScore() {
        this.errorMessage = null;
        if (!this.selectedMatch || this.scoreForm.invalid) {
            this.errorMessage = 'Por favor completa todos los campos requeridos correctamente.';
            return;
        }

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
                this.toast.success('Resultado guardado');
            },
            error: (error) => {
                this.errorMessage = 'Error al actualizar: ' + (error.error?.message || 'Error desconocido');
                this.toast.error(this.errorMessage);
                this.cdr.markForCheck();
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
                this.toast.success('¡Torneo finalizado exitosamente!');
                this.cdr.markForCheck();
            },
            error: (error) => {
                this.errorMessage = 'Error al finalizar el torneo: ' + (error.error?.message || 'Error desconocido');
                this.toast.error(this.errorMessage);
                this.cdr.markForCheck();
            }
        });
    }

    getTournamentTypeLabel(): string {
        const labels: Record<string, string> = {
            'cuadrangular': 'Cuadrangular',
            'hexagonal': 'Hexagonal',
            'octagonal': 'Octagonal',
            'decagonal': 'Decagonal',
            'dodecagonal': 'Dodecagonal',
        };
        return labels[this.tournament?.type || ''] || this.tournament?.type || '';
    }

    getDurationModeLabel(): string {
        if (this.tournament?.durationMode === 'fixed') return '⏰ Tiempo Fijo';
        return '♾️ Tiempo Libre';
    }
}
