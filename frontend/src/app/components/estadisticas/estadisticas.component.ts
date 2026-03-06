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
        totalMatches: 0,
        topPlayers: [],
        topPairs: [],
    };

    // Free-play monthly stats
    freePlayMatches: FreePlayMatch[] = [];
    freePlayTopPlayers: { name: string; wins: number; played: number }[] = [];

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
                this.stats = { month: this.selectedMonth, year: this.selectedYear, totalTournaments: 0, totalMatches: 0, topPlayers: [], topPairs: [] };
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
                    this.cdr.markForCheck();
                },
                error: () => {
                    this.freePlayMatches = [];
                    this.freePlayTopPlayers = [];
                    this.cdr.markForCheck();
                }
            });
        }
    }

    private buildFreePlayTopPlayers() {
        const playerMap = new Map<string, { name: string; wins: number; played: number }>();
        for (const match of this.freePlayMatches) {
            const allNames = [...(match.team1Names || []), ...(match.team2Names || [])];
            for (let i = 0; i < allNames.length; i++) {
                const name = allNames[i];
                if (!name) continue;
                if (!playerMap.has(name)) playerMap.set(name, { name, wins: 0, played: 0 });
                const p = playerMap.get(name)!;
                p.played++;
                const isTeam1 = i < (match.team1Names?.length || 0);
                if ((isTeam1 && match.winner === 1) || (!isTeam1 && match.winner === 2)) {
                    p.wins++;
                }
            }
        }
        this.freePlayTopPlayers = Array.from(playerMap.values())
            .sort((a, b) => b.wins - a.wins || b.played - a.played)
            .slice(0, 10);
    }

    getWinRate(won: number, played: number): string {
        if (played === 0) return '0';
        return ((won / played) * 100).toFixed(0);
    }
}
