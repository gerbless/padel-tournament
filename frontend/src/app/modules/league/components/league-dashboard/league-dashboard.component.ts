import { Component, OnInit, DestroyRef, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LeagueService } from '../../services/league.service';
import { League, Match, MatchResult, SetScore, Pair } from '../../../../models/league.model';

import { AuthService } from '../../../../services/auth.service';
import { ToastService } from '../../../../services/toast.service';
import { LeagueBracketComponent } from '../league-bracket/league-bracket.component';

@Component({
    selector: 'app-league-dashboard',
    standalone: true,
    imports: [CommonModule, FormsModule, LeagueBracketComponent],
    templateUrl: './league-dashboard.component.html',
    styleUrls: ['./league-dashboard.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeagueDashboardComponent implements OnInit {
    league: League | null = null;
    loading = true;
    activeTab: 'matches' | 'standings' | 'bracket' | 'config' = 'matches';
    isLoggedIn = false;
    canEdit = false;
    canAdmin = false;

    // Match result modal
    showResultModal = false;
    savingResult = false; // New state for loading
    selectedMatch: Match | null = null;
    matchResult: MatchResult = {
        sets: [
            { pairAGames: 6, pairBGames: 4 },
            { pairAGames: 4, pairBGames: 6 },
            { pairAGames: 7, pairBGames: 5 }
        ],
        winnerPairId: '',
        pointsAwarded: { pairA: 0, pairB: 0 },
        completedAt: new Date()
    };

    // ... (existing code) ...

    saveMatchResult() {
        if (!this.selectedMatch || !this.league) return;

        // Validate result
        const validation = this.leagueService.validateMatchResult(
            this.matchResult,
            this.league.config
        );

        if (!validation.valid) {
            alert(validation.error);
            return;
        }

        // Calculate winner
        let pairAWins = 0;
        let pairBWins = 0;
        this.matchResult.sets.forEach(set => {
            if (set.pairAGames > set.pairBGames) pairAWins++;
            else pairBWins++;
        });

        this.matchResult.winnerPairId = pairAWins > pairBWins
            ? this.selectedMatch.pairA.id
            : this.selectedMatch.pairB.id;

        // Start loading
        this.savingResult = true;

        // Save to backend
        this.leagueService.updateMatchResult(
            this.league.id,
            this.selectedMatch.id,
            this.matchResult
        ).subscribe({
            next: () => {
                this.savingResult = false;
                this.closeResultModal();
                this.loadLeague(this.league!.id);
                this.toast.success('Resultado guardado');
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.savingResult = false;
                const msg = err.error?.message || err.message || 'Error desconocido';
                this.toast.error(`Error al guardar: ${msg}`);
                this.cdr.markForCheck();
            }
        });
    }

    // Filters
    selectedRound: number = 0;
    selectedPhase: string = 'all';

    private destroyRef = inject(DestroyRef);

    private cdr = inject(ChangeDetectorRef);
    private toast = inject(ToastService);

    constructor(
        private route: ActivatedRoute,
        private router: Router,
        private leagueService: LeagueService,
        private authService: AuthService
    ) { }

    ngOnInit() {
        this.isLoggedIn = this.authService.isAuthenticated();
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.loadLeague(id);
        }
    }

    private updatePermissions() {
        if (this.league?.clubId) {
            this.canEdit = this.authService.hasClubRole(this.league.clubId, 'editor');
            this.canAdmin = this.authService.hasClubRole(this.league.clubId, 'admin');
        } else {
            this.canEdit = false;
            this.canAdmin = false;
        }
    }

    availableRounds: number[] = [];

    loadLeague(id: string) {
        this.loading = true;
        this.leagueService.getLeagueById(id).subscribe({
            next: (league) => {
                // Normalize backend 'teams' to frontend 'pairs'
                this.normalizePairs(league);
                this.normalizeConfig(league);
                this.league = league;
                this.updatePermissions();
                this.updateAvailableRounds();
                this.loading = false;
                if (league.currentRound) {
                    this.selectedRound = league.currentRound;
                }
                this.cdr.markForCheck();
            },
            error: (err) => {
                console.error('Error loading league:', err);
                this.loading = false;
                this.cdr.markForCheck();
                alert('Error al cargar la liga');
                this.router.navigate(['/leagues']);
            }
        });
    }

    private updateAvailableRounds() {
        if (!this.league || !this.league.matches || this.league.matches.length === 0) {
            this.availableRounds = [];
            return;
        }
        const maxRound = this.league.matches.reduce((max, m) => Math.max(max, Number(m.round) || 0), 0);
        this.availableRounds = Array.from({ length: maxRound }, (_, i) => i + 1);
    }



    // Convert backend teams to frontend pairs and normalize matches recursively
    private normalizePairs(league: League) {
        const transformTeamToPair = (team: any) => {
            if (!team) return null;
            // If it's already in frontend format (has playerA), return it
            if (team.playerA) return team;

            // Transform backend team to frontend pair
            return {
                id: team.id,
                playerA: team.player1 || { name: '?' },
                playerB: team.player2 || { name: '?' },
                points: team.points || 0,
                wins: team.matchesWon || 0,
                draws: 0,
                losses: team.matchesLost || 0,
                setsWon: team.setsWon || 0,
                setsLost: team.setsLost || 0,
                gamesWon: team.gamesWon || 0,
                gamesLost: team.gamesLost || 0,
                matchHistory: [],
                groupId: team.group
            };
        };

        // 1. Normalize Teams -> Pairs
        if (league.teams) {
            league.pairs = league.teams.map(transformTeamToPair);
        }

        if (!league.pairs) {
            league.pairs = [];
        }

        // 2. Normalize Matches (team1 -> pairA, team2 -> pairB)
        if (league.matches) {
            league.matches = league.matches.map((match: any) => {
                const normalizedMatch = {
                    ...match,
                    pairA: transformTeamToPair(match.team1 || match.pairA),
                    pairB: transformTeamToPair(match.team2 || match.pairB),
                    group: match.group,
                    phase: this.mapGroupToPhase(match.group)
                };

                // Normalize 'result' object if backend sends flat fields
                if (match.status === 'completed' && match.winnerId && !match.result) {
                    normalizedMatch.result = {
                        winnerPairId: match.winnerId,
                        sets: match.sets || [],
                        pointsAwarded: { pairA: 0, pairB: 0 }, // Placeholder
                        completedAt: match.matchDate || new Date()
                    };
                }

                return normalizedMatch;
            });
        }
    }

    private mapGroupToPhase(group: string | undefined): string {
        if (!group) return 'group';
        if (group.includes('3rd')) return 'third_place';
        if (group.includes('Gold')) return 'gold';
        if (group.includes('Silver')) return 'silver';
        if (group.includes('Bronze')) return 'bronze';
        if (group.includes('QF')) return 'quarterfinal';
        if (group.includes('SF')) return 'semifinal';
        if (group.includes('F')) return 'final';
        return 'group';
    }

    getPhaseLabel(group: string | undefined): string {
        if (!group) return 'Fase de Grupos';

        let label = '';
        if (group.includes('Gold')) label += 'Copa Oro - ';
        else if (group.includes('Silver')) label += 'Copa Plata - ';
        else if (group.includes('Bronze')) label += 'Copa Bronce - ';

        if (group.includes('3rd')) label += 'Tercer Puesto';
        else if (group.includes('QF')) label += 'Cuartos de Final';
        else if (group.includes('SF')) label += 'Semifinal';
        else if (group.includes('F') && !group.includes('QF') && !group.includes('SF')) label += 'Final';
        else if (!label) label = 'Fase Regular';

        return label;
    }

    private getPair(match: any, side: 'A' | 'B'): any {
        if (!match) return null;
        if (side === 'A') return match.pairA || match.team1;
        if (side === 'B') return match.pairB || match.team2;
        return null;
    }

    get champions() {
        if (!this.league) return null;

        // Round Robin Strategy: Top 3 from standings
        if (this.league.type === 'round_robin') {
            if (this.league.status !== 'completed' && this.league.status !== 'active') return null;

            const sorted = this.standingsSorted;
            return {
                gold: sorted[0] || null,
                silver: sorted[1] || null,
                bronze: sorted[2] || null
            };
        }

        // Playoff Strategy
        if (!this.league.matches) return null;

        const getWinner = (groupSuffix: string) => {
            const groupName = `Playoff${groupSuffix}_F`;
            let final = this.league!.matches!.find(m => m.group === groupName && m.status === 'completed');

            // Fallback for standard finals without group suffix
            if (!final && groupSuffix === '') {
                final = this.league!.matches!.find(m => (m.phase === 'final' || m.group === 'Playoff_F') && m.status === 'completed');
            }

            if (final && final.result && final.result.winnerPairId) {
                const winnerId = final.result.winnerPairId;
                const pairA = this.getPair(final, 'A');
                const pairB = this.getPair(final, 'B');

                if (pairA && pairA.id === winnerId) return pairA;
                if (pairB && pairB.id === winnerId) return pairB;
            }
            return null;
        };

        const getRunnerUp = (groupSuffix: string) => {
            const groupName = `Playoff${groupSuffix}_F`;
            let final = this.league!.matches!.find(m => m.group === groupName && m.status === 'completed');

            if (!final && groupSuffix === '') {
                final = this.league!.matches!.find(m => (m.phase === 'final' || m.group === 'Playoff_F') && m.status === 'completed');
            }

            if (final && final.result && final.result.winnerPairId) {
                const winnerId = final.result.winnerPairId;
                const pairA = this.getPair(final, 'A');
                const pairB = this.getPair(final, 'B');

                // Runner up is the one who is NOT the winner
                if (pairA && pairA.id === winnerId) return pairB;
                return pairA;
            }
            return null;
        }

        // Check if Multi-Tier (mapped by existence of Gold/Silver finals)
        const hasTieredFinals = this.league.matches.some(m => m.group && (m.group.includes('_Gold_') || m.group.includes('_Silver_')));

        if (!hasTieredFinals) {
            // Standard Single Tier: Gold = Winner, Silver = RunnerUp
            return {
                gold: getWinner(''),
                silver: getRunnerUp(''),
                bronze: null
            };
        }

        // Multi-Tier Strategy
        return {
            gold: getWinner('') || getWinner('_Gold'),
            silver: getWinner('_Silver'),
            bronze: getWinner('_Bronze')
        };
    }

    getPairName(pair: any): string {
        if (!pair) return 'Desconocido';
        // Handle both 'pair' (frontend) and 'team' (backend) structures if they differ slightly
        // Usually pair.teamName or pair.playerA
        if (pair.teamName) return pair.teamName;

        const p1 = pair.playerA || pair.player1;
        const p2 = pair.playerB || pair.player2;

        if (p1 && p2) {
            return `${this.getName(p1)} / ${this.getName(p2)}`;
        }
        return 'Pareja Desconocida';
    }

    private normalizeConfig(league: League) {
        if (!league.config) return;
        const c = league.config as any;
        // Map backend names to frontend expected names if missing
        if (c.pointsWin === undefined) c.pointsWin = c.pointsForWin ?? 3; // Default 3
        if (c.pointsLoss === undefined) c.pointsLoss = c.pointsForLoss ?? 0; // Default 0
        if (c.pointsDraw === undefined) c.pointsDraw = c.pointsForDraw ?? 0; // Default 0 (padel has no draws)

        // Ensure other properties exist
        if (c.setsToWin === undefined) c.setsToWin = c.setsPerMatch || 2;
        if (c.gamesPerSet === undefined) c.gamesPerSet = 6;
        if (c.tiebreakAt === undefined) c.tiebreakAt = 6;
    }

    get filteredMatches(): Match[] {
        if (!this.league) return [];

        let matches = this.league.matches;

        // Filter by round (force number conversion)
        const roundNum = Number(this.selectedRound);
        if (roundNum > 0) {
            matches = matches.filter(m => Number(m.round) === roundNum);
        }

        if (this.selectedPhase !== 'all') {
            matches = matches.filter(m => m.phase === this.selectedPhase);
        }

        return matches;
    }

    get standingsSorted(): Pair[] {
        if (!this.league || !this.league.pairs) return [];
        return [...this.league.pairs].sort((a, b) => {
            if (a.points !== b.points) return b.points - a.points;
            if ((a.setsWon - a.setsLost) !== (b.setsWon - b.setsLost)) {
                return (b.setsWon - b.setsLost) - (a.setsWon - a.setsLost);
            }
            return (b.gamesWon - b.gamesLost) - (a.gamesWon - a.gamesLost);
        });
    }

    get groupNames(): string[] {
        if (!this.league || !this.league.pairs) return [];
        const groups = new Set(this.league.pairs.map(p => p.groupId).filter(g => !!g) as string[]);
        return Array.from(groups).sort();
    }

    getStandingsByGroup(group: string): Pair[] {
        return this.standingsSorted.filter(p => p.groupId === group);
    }

    get standingSections(): { title: string, pairs: Pair[] }[] {
        if (!this.league) return [];
        if (this.league.type === 'groups_playoff') {
            return this.groupNames.map(g => ({
                title: `Grupo ${g}`,
                pairs: this.getStandingsByGroup(g)
            }));
        }
        return [{ title: '', pairs: this.standingsSorted }];
    }

    getStandingZoneStyle(index: number): string {
        if (!this.league || this.league.type !== 'round_robin_playoff') return '';
        const config = this.league.config as any;
        const goldCount = config.goldPlayoffCount ?? 4;
        const silverCount = config.silverPlayoffCount ?? 4;
        const relegationCount = config.relegationCount ?? 0;
        const totalPairs = this.standingsSorted.length;

        if (index < goldCount) return '4px solid #FFD700';
        if (index < goldCount + silverCount) return '4px solid #C0C0C0';
        if (relegationCount > 0 && index >= totalPairs - relegationCount) return '4px solid #FF4444';
        return '';
    }

    getStandingZoneLabel(index: number): string {
        if (!this.league || this.league.type !== 'round_robin_playoff') return '';
        const config = this.league.config as any;
        const goldCount = config.goldPlayoffCount ?? 4;
        const silverCount = config.silverPlayoffCount ?? 4;
        const relegationCount = config.relegationCount ?? 0;
        const totalPairs = this.standingsSorted.length;

        if (index === 0) return '🥇 Liga Oro';
        if (index === goldCount) return '🥈 Liga Plata';
        if (relegationCount > 0 && index === totalPairs - relegationCount) return '⬇️ Descenso';
        return '';
    }

    get completedMatchesCount(): number {
        if (!this.league) return 0;
        return this.league.matches?.filter(m => m.status === 'completed').length || 0;
    }

    openResultModal(match: Match) {
        if (this.league?.status === 'completed') {
            alert('La liga está finalizada. No se pueden modificar los resultados.');
            return;
        }

        if (match.status === 'completed') {
            alert('Este partido ya tiene resultado registrado');
            return;
        }

        this.selectedMatch = match;
        this.matchResult = {
            sets: [
                { pairAGames: 0, pairBGames: 0 },
                { pairAGames: 0, pairBGames: 0 }
            ],
            winnerPairId: '',
            pointsAwarded: { pairA: 0, pairB: 0 },
            completedAt: new Date()
        };
        this.showResultModal = true;
    }

    closeResultModal() {
        this.showResultModal = false;
        this.selectedMatch = null;
    }

    addSet() {
        if (this.matchResult.sets.length < 3) {
            this.matchResult.sets.push({ pairAGames: 0, pairBGames: 0 });
        }
    }

    removeSet(index: number) {
        if (this.matchResult.sets.length > 1) {
            this.matchResult.sets.splice(index, 1);
        }
    }

    getInitials(player: any): string {
        if (!player || !player.name) return '?';
        return player.name
            .split(' ')
            .map((n: string) => n[0])
            .join('')
            .toUpperCase()
            .substring(0, 2);
    }

    getName(player: any): string {
        return player?.name || 'Desconocido';
    }

    // Schedule Generation Modal
    showScheduleConfirmationModal = false;

    generateSchedule() {
        this.showScheduleConfirmationModal = true;
    }

    closeScheduleConfirmationModal() {
        this.showScheduleConfirmationModal = false;
    }

    confirmGenerateSchedule() {
        if (!this.league) return;
        this.closeScheduleConfirmationModal();
        this.loading = true; // Show loading indicator

        this.leagueService.generateSchedule(this.league.id).subscribe({
            next: () => {
                this.loadLeague(this.league!.id);
                this.toast.success('Calendario generado exitosamente');
            },
            error: (err) => {
                this.loading = false;
                this.toast.error('Error al generar calendario');
                this.cdr.markForCheck();
            }
        });
    }

    // Suggestion Modal
    showSuggestionModal = false;
    suggestedMatch: any = null;

    suggestNextMatch() {
        if (!this.league) return;

        this.leagueService.suggestNextMatch(this.league.id).subscribe({
            next: (match: any) => {
                // Normalize backend response to frontend format if needed
                if (!match.pairA && match.team1) {
                    match.pairA = match.team1;
                    match.pairB = match.team2;
                }
                this.suggestedMatch = match;
                this.showSuggestionModal = true;
                this.cdr.markForCheck();
            },
            error: (err) => {
                console.error('Error suggesting match:', err);
                alert('No hay partidos pendientes o error al generar sugerencia');
            }
        });
    }

    closeSuggestionModal() {
        this.showSuggestionModal = false;
        this.suggestedMatch = null;
    }

    getMatchStatus(status: string): string {
        const labels: Record<string, string> = {
            'pending': 'Pendiente',
            'scheduled': 'Programado',
            'in_progress': 'En curso',
            'completed': 'Completado',
            'cancelled': 'Cancelado'
        };
        return labels[status] || status;
    }

    confirmCompleteLeague() {
        if (confirm('¿Estás seguro de que deseas finalizar la liga? Esto marcará el torneo como completado y no se podrán modificar resultados.')) {
            if (!this.league) return;
            this.leagueService.completeLeague(this.league.id).subscribe({
                next: () => {
                    this.loadLeague(this.league!.id);
                    this.toast.success('¡Liga finalizada! Felicidades a los campeones 🏆');
                },
                error: () => this.toast.error('Error al finalizar la liga')
            });
        }
    }

    get hasTies(): boolean {
        if (!this.league || this.league.status === 'completed') return false;
        // Only relevant for round_robin or groups if we want to resolve group ties (but user asked for standings)
        if (this.league.type !== 'round_robin') return false;

        const standings = this.standingsSorted;
        if (standings.length < 2) return false;

        const isTied = (t1: any, t2: any) => {
            if (!t1 || !t2) return false;
            const diffA = t1.setsWon - t1.setsLost;
            const diffB = t2.setsWon - t2.setsLost;
            const gamesDiffA = t1.gamesWon - t1.gamesLost;
            const gamesDiffB = t2.gamesWon - t2.gamesLost;
            return t1.points === t2.points && diffA === diffB && gamesDiffA === gamesDiffB;
        };

        // Check Top 3 Ties
        if (isTied(standings[0], standings[1])) return true;
        if (standings.length >= 3 && isTied(standings[1], standings[2])) return true;
        if (standings.length >= 4 && isTied(standings[2], standings[3])) return true;

        return false;
    }

    generateTieBreaker() {
        if (!confirm('Se han detectado empates en los primeros lugares. ¿Deseas generar partidos de desempate?')) return;

        this.leagueService.generateTieBreaker(this.league!.id).subscribe({
            next: () => {
                this.loadLeague(this.league!.id);
                this.toast.success('Partidos de desempate generados. ¡Juégalos para definir posiciones!');
            },
            error: () => this.toast.error('No se pudieron generar los partidos de desempate')
        });
    }
}
