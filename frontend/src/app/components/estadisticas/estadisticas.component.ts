import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TournamentService, MonthlyStats } from '../../services/tournament.service';
import { ClubService } from '../../services/club.service';
import { CourtService } from '../../services/court.service';
import { FreePlayMatch } from '../../models/court.model';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-estadisticas',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './estadisticas.component.html',
    styleUrls: ['./estadisticas.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class EstadisticasComponent implements OnInit, OnDestroy {
    loading = true;
    selectedMonth: number;
    selectedYear: number;
    monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    viewMode: 'players' | 'pairs' = 'players';

    stats: MonthlyStats = {
        month: 0,
        year: 0,
        totalTournaments: 0,
        totalLeagues: 0,
        totalCompetitions: 0,
        totalMatches: 0,
        topPlayers: [],
        topPairs: [],
    };

    // Free-play monthly stats
    freePlayMatches: FreePlayMatch[] = [];
    freePlayTopPlayers: { name: string; wins: number; played: number; points: number }[] = [];
    freePlayTopPairs: import('../../services/tournament.service').MonthlyPairStat[] = [];

    get monthlyTopPlayersCombined(): { name: string; matchesWon: number; matchesPlayed: number; tournamentsPlayed: number; freePlayPoints: number }[] {
        const map = new Map<string, { name: string; matchesWon: number; matchesPlayed: number; tournamentsPlayed: number; freePlayPoints: number }>();

        for (const p of this.stats.topPlayers) {
            const key = (p.name || '').trim().toLowerCase();
            if (!key) continue;
            if (!map.has(key)) {
                map.set(key, {
                    name: p.name,
                    matchesWon: 0,
                    matchesPlayed: 0,
                    tournamentsPlayed: 0,
                    freePlayPoints: 0,
                });
            }
            const item = map.get(key)!;
            item.matchesWon += p.matchesWon;
            item.matchesPlayed += p.matchesPlayed;
            item.tournamentsPlayed += p.tournamentsPlayed;
        }

        for (const p of this.freePlayTopPlayers) {
            const key = (p.name || '').trim().toLowerCase();
            if (!key) continue;
            if (!map.has(key)) {
                map.set(key, {
                    name: p.name,
                    matchesWon: 0,
                    matchesPlayed: 0,
                    tournamentsPlayed: 0,
                    freePlayPoints: 0,
                });
            }
            const item = map.get(key)!;
            item.matchesWon += p.wins;
            item.matchesPlayed += p.played;
            item.freePlayPoints += p.points;
        }

        return Array.from(map.values())
            .sort((a, b) =>
                b.matchesWon - a.matchesWon ||
                b.matchesPlayed - a.matchesPlayed ||
                b.freePlayPoints - a.freePlayPoints
            )
            .slice(0, 20);
    }

    private clubSubscription?: Subscription;

    constructor(
        private tournamentService: TournamentService,
        private clubService: ClubService,
        private courtService: CourtService,
        private cdr: ChangeDetectorRef
    ) {
        const now = new Date();
        this.selectedMonth = now.getMonth() + 1;
        this.selectedYear = now.getFullYear();
    }

    ngOnInit() {
        this.clubSubscription = this.clubService.selectedClub$.subscribe(() => {
            this.loadStats();
        });
    }

    ngOnDestroy() {
        this.clubSubscription?.unsubscribe();
    }

    prevMonth() {
        if (this.selectedMonth === 1) {
            this.selectedMonth = 12;
            this.selectedYear--;
        } else {
            this.selectedMonth--;
        }
        this.loadStats();
    }

    nextMonth() {
        if (this.selectedMonth === 12) {
            this.selectedMonth = 1;
            this.selectedYear++;
        } else {
            this.selectedMonth++;
        }
        this.loadStats();
    }

    loadStats() {
        this.loading = true;
        const clubId = this.clubService.getSelectedClub()?.id;
        this.tournamentService.getMonthlyStats(this.selectedMonth, this.selectedYear, clubId).subscribe({
            next: (stats) => {
                this.stats = stats;
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (err) => {
                console.error('Error loading monthly stats:', err);
                this.stats = {
                    month: this.selectedMonth,
                    year: this.selectedYear,
                    totalTournaments: 0,
                    totalLeagues: 0,
                    totalCompetitions: 0,
                    totalMatches: 0,
                    topPlayers: [],
                    topPairs: [],
                };
                this.loading = false;
                this.cdr.markForCheck();
            }
        });

        // Load free-play matches for this month
        if (clubId) {
            const startDate = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-01`;
            const lastDay = new Date(this.selectedYear, this.selectedMonth, 0).getDate();
            const endDate = `${this.selectedYear}-${String(this.selectedMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
            this.courtService.getFreePlayMatchesByClub(clubId, startDate, endDate).subscribe({
                next: (matches) => {
                    this.freePlayMatches = matches.filter(m => m.status === 'completed');
                    this.buildFreePlayTopPlayers();
                    this.buildFreePlayTopPairs();
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.freePlayMatches = [];
                    this.freePlayTopPlayers = [];
                    this.freePlayTopPairs = [];
                    this.cdr.markForCheck();
                }
            });
        }
    }
    private buildFreePlayTopPairs() {
        const pairMap = new Map<string, { player1Name: string; player2Name: string; matchesWon: number; matchesPlayed: number }>();
        for (const match of this.freePlayMatches) {
            const t1 = match.team1Names || [];
            const t2 = match.team2Names || [];
            if (t1.length === 2) {
                const key = [t1[0], t1[1]].sort().join('|');
                if (!pairMap.has(key)) pairMap.set(key, { player1Name: t1[0], player2Name: t1[1], matchesWon: 0, matchesPlayed: 0 });
                const pair = pairMap.get(key)!;
                pair.matchesPlayed++;
                if (match.winner === 1) pair.matchesWon++;
            }
            if (t2.length === 2) {
                const key = [t2[0], t2[1]].sort().join('|');
                if (!pairMap.has(key)) pairMap.set(key, { player1Name: t2[0], player2Name: t2[1], matchesWon: 0, matchesPlayed: 0 });
                const pair = pairMap.get(key)!;
                pair.matchesPlayed++;
                if (match.winner === 2) pair.matchesWon++;
            }
        }
        this.freePlayTopPairs = Array.from(pairMap.values())
            .map(p => ({ ...p, tournamentsPlayed: 0 }))
            .sort((a, b) => b.matchesWon - a.matchesWon || b.matchesPlayed - a.matchesPlayed)
            .slice(0, 20);
    }

    private buildFreePlayTopPlayers() {
        const playerMap = new Map<string, { name: string; wins: number; played: number; points: number }>();
        for (const match of this.freePlayMatches) {
            const allNames = [...(match.team1Names || []), ...(match.team2Names || [])];
            for (let i = 0; i < allNames.length; i++) {
                const name = allNames[i];
                if (!name) continue;
                if (!playerMap.has(name)) playerMap.set(name, { name, wins: 0, played: 0, points: 0 });
                const p = playerMap.get(name)!;
                p.played++;
                const isTeam1 = i < (match.team1Names?.length || 0);
                if ((isTeam1 && match.winner === 1) || (!isTeam1 && match.winner === 2)) {
                    p.wins++;
                    p.points += match.pointsPerWin || 0;
                }
            }
        }
        this.freePlayTopPlayers = Array.from(playerMap.values())
            .sort((a, b) => b.points - a.points || b.wins - a.wins || b.played - a.played)
            .slice(0, 10);
    }

    getWinRate(won: number, played: number): string {
        if (played === 0) return '0';
        return ((won / played) * 100).toFixed(0);
    }
}
