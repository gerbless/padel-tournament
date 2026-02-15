import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TournamentService, MonthlyStats } from '../../services/tournament.service';
import { ClubService } from '../../services/club.service';
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

    private clubSubscription?: Subscription;

    constructor(
        private tournamentService: TournamentService,
        private clubService: ClubService,
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
    }

    getWinRate(won: number, played: number): string {
        if (played === 0) return '0';
        return ((won / played) * 100).toFixed(0);
    }
}
