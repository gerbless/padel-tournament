import { Component, OnInit, DestroyRef, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { PlayerService, Player } from '../../services/player.service';
import { TournamentService, Tournament } from '../../services/tournament.service';
import { LeagueService } from '../../modules/league/services/league.service';
import { League } from '../../models/league.model';
import { CategoryService } from '../../modules/categories/services/category.service';
import { ClubService } from '../../services/club.service';
import { FormsModule } from '@angular/forms';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, NgChartsModule, FormsModule],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class DashboardComponent implements OnInit {
    // Stats
    totalPlayers = 0;
    totalTournaments = 0;
    activeTournaments = 0;
    totalLeagues = 0;
    activeLeagues = 0;
    totalMatches = 0;

    // Charts
    public barChartLegend = true;
    public barChartPlugins = [];

    public globalRankingData: ChartConfiguration<'bar'>['data'] = {
        labels: [],
        datasets: [
            { data: [], label: 'Ranking Global', backgroundColor: 'rgba(16, 185, 129, 0.8)' }
        ]
    };

    public leagueRankingData: ChartConfiguration<'bar'>['data'] = {
        labels: [],
        datasets: [
            { data: [], label: 'Ranking Ligas', backgroundColor: 'rgba(239, 68, 68, 0.8)' }
        ]
    };

    public tournamentRankingData: ChartConfiguration<'bar'>['data'] = {
        labels: [],
        datasets: [
            { data: [], label: 'Ranking Torneos', backgroundColor: 'rgba(59, 130, 246, 0.8)' }
        ]
    };

    public barChartOptions: ChartConfiguration<'bar'>['options'] = {
        responsive: true,
        plugins: {
            legend: { display: true },
            title: { display: true, text: 'Top 10 Global' }
        }
    };

    public leagueChartOptions: ChartConfiguration<'bar'>['options'] = {
        responsive: true,
        plugins: {
            legend: { display: true },
            title: { display: true, text: 'Top 5 Ligas' }
        }
    };

    public tournamentChartOptions: ChartConfiguration<'bar'>['options'] = {
        responsive: true,
        plugins: {
            legend: { display: true },
            title: { display: true, text: 'Top 5 Torneos' }
        }
    };

    public pieChartData: ChartConfiguration<'pie'>['data'] = {
        labels: ['Victorias', 'Derrotas'],
        datasets: [{
            data: [0, 0],
            backgroundColor: ['rgba(59, 130, 246, 0.8)', 'rgba(239, 68, 68, 0.8)']
        }]
    };

    public pieChartOptions: ChartConfiguration<'pie'>['options'] = {
        responsive: true,
        plugins: {
            title: { display: true, text: 'Distribución de Puntos (Dominio)' }
        }
    };

    // View Mode
    viewMode: 'players' | 'pairs' = 'players';

    // Pair Data Buffers
    private globalPairs: any[] = [];
    private leaguePairs: any[] = [];
    private tournamentPairs: any[] = [];

    // Player Data Buffers (to restore when switching back)
    private globalPlayers: any[] = [];
    private leaguePlayers: any[] = [];
    private tournamentPlayers: any[] = [];

    // Recommendations
    public recommendedMatches: any[] = [];
    public partnerRecommendations: any[] = [];

    // Category Filtering
    categories: any[] = [];
    selectedCategoryId: string = '';
    selectedClubId: string | null = null;

    private destroyRef = inject(DestroyRef);

    private cdr = inject(ChangeDetectorRef);

    constructor(
        private playerService: PlayerService,
        private tournamentService: TournamentService,
        private leagueService: LeagueService,
        private categoryService: CategoryService,
        private clubService: ClubService
    ) { }

    ngOnInit() {
        this.loadCategories();
        // Subscribe to selected club
        this.clubService.selectedClub$.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(club => {
            this.selectedClubId = club?.id || null;
            this.loadStats();
            this.cdr.markForCheck();
        });
    }

    loadCategories() {
        this.categoryService.findAll().subscribe(cats => {
            this.categories = cats;
            this.cdr.markForCheck();
        });
    }

    onCategoryChange(categoryId: string) {
        this.selectedCategoryId = categoryId;
        this.loadStats();
    }

    toggleView(mode: 'players' | 'pairs') {
        this.viewMode = mode;
        this.updateCharts();
    }

    updateCharts() {
        if (this.viewMode === 'players') {
            this.globalRankingData.labels = this.globalPlayers.map(p => p.name);
            this.globalRankingData.datasets[0].data = this.globalPlayers.map(p => p.totalPoints);
            this.globalRankingData.datasets[0].label = 'Ranking Global (Jugadores)';

            this.leagueRankingData.labels = this.leaguePlayers.map(p => p.name);
            this.leagueRankingData.datasets[0].data = this.leaguePlayers.map(p => (p.leaguePoints || 0));
            this.leagueRankingData.datasets[0].label = 'Ranking Ligas (Jugadores)';

            this.tournamentRankingData.labels = this.tournamentPlayers.map(p => p.name);
            this.tournamentRankingData.datasets[0].data = this.tournamentPlayers.map(p => (p.tournamentPoints || 0));
            this.tournamentRankingData.datasets[0].label = 'Ranking Torneos (Jugadores)';
        } else {
            this.globalRankingData.labels = this.globalPairs.map(p => `${p.p1.name} / ${p.p2.name}`);
            this.globalRankingData.datasets[0].data = this.globalPairs.map(p => p.points);
            this.globalRankingData.datasets[0].label = 'Ranking Global (Parejas)';

            this.leagueRankingData.labels = this.leaguePairs.map(p => `${p.p1.name} / ${p.p2.name}`);
            this.leagueRankingData.datasets[0].data = this.leaguePairs.map(p => p.points);
            this.leagueRankingData.datasets[0].label = 'Ranking Ligas (Parejas)';

            this.tournamentRankingData.labels = this.tournamentPairs.map(p => `${p.p1.name} / ${p.p2.name}`);
            this.tournamentRankingData.datasets[0].data = this.tournamentPairs.map(p => p.points);
            this.tournamentRankingData.datasets[0].label = 'Ranking Torneos (Parejas)';
        }

        // Trigger updates
        this.globalRankingData = { ...this.globalRankingData };
        this.leagueRankingData = { ...this.leagueRankingData };
        this.tournamentRankingData = { ...this.tournamentRankingData };
    }

    loadStats() {
        const catId = this.selectedCategoryId || undefined;
        const clubId = this.selectedClubId || undefined;

        // 1. Recommended Matches - filtered by club
        this.playerService.getRecommendedMatches(clubId).subscribe(matches => {
            this.recommendedMatches = matches;
            this.cdr.markForCheck();
        });

        // 1b. Partner Recommendations - filtered by club
        this.playerService.getPartnerRecommendations(clubId).subscribe(partners => {
            this.partnerRecommendations = partners;
            this.cdr.markForCheck();
        });

        // 2. Load Player Data - filtered by club and category
        this.playerService.getRanking(catId, clubId).subscribe(players => {
            this.totalPlayers = players.length;
            this.globalPlayers = players.slice(0, 10);

            // Points Distribution Update
            const top10Points = players.slice(0, 10).reduce((acc, p) => acc + p.totalPoints, 0);
            const restPoints = players.slice(10).reduce((acc, p) => acc + p.totalPoints, 0);

            this.pieChartData.labels = ['Top 10 Puntos', 'Resto del Mundo'];
            this.pieChartData.datasets[0].data = [top10Points, restPoints];
            this.pieChartData = { ...this.pieChartData };

            if (this.viewMode === 'players') this.updateCharts();
            this.cdr.markForCheck();
        });

        this.playerService.getLeagueRanking(catId, clubId).subscribe(players => {
            this.leaguePlayers = players.slice(0, 5);
            if (this.viewMode === 'players') this.updateCharts();
            this.cdr.markForCheck();
        });

        this.playerService.getTournamentRanking(catId, clubId).subscribe(players => {
            this.tournamentPlayers = players.slice(0, 5);
            if (this.viewMode === 'players') this.updateCharts();
            this.cdr.markForCheck();
        });

        // 2. Load Pair Data - filtered by club and category
        this.playerService.getPairRanking('global', catId, clubId).subscribe(pairs => {
            this.globalPairs = pairs.slice(0, 10);
            if (this.viewMode === 'pairs') this.updateCharts();
            this.cdr.markForCheck();
        });

        this.playerService.getPairRanking('league', catId, clubId).subscribe(pairs => {
            this.leaguePairs = pairs.slice(0, 5);
            if (this.viewMode === 'pairs') this.updateCharts();
            this.cdr.markForCheck();
        });

        this.playerService.getPairRanking('tournament', catId, clubId).subscribe(pairs => {
            this.tournamentPairs = pairs.slice(0, 5);
            if (this.viewMode === 'pairs') this.updateCharts();
            this.cdr.markForCheck();
        });

        // Load Tournaments & Leagues - filtered by club
        let matchesCount = 0;

        this.tournamentService.getTournaments(clubId).subscribe((tournaments: Tournament[]) => {
            this.totalTournaments = tournaments.length;
            this.activeTournaments = tournaments.filter(t => t.status !== 'completed').length;

            matchesCount += tournaments.reduce((acc, t) => {
                return acc + (t.matches ? t.matches.filter(m => m.status === 'completed').length : 0);
            }, 0);
            this.totalMatches = matchesCount;
            this.cdr.markForCheck();
        });

        this.leagueService.getLeagues(clubId).subscribe((leagues: League[]) => {
            this.totalLeagues = leagues.length;
            this.activeLeagues = leagues.filter(l => l.status !== 'completed').length;

            matchesCount += leagues.reduce((acc, l) => {
                return acc + (l.matches ? l.matches.filter(m => m.status === 'completed').length : 0);
            }, 0);
            this.totalMatches = matchesCount;
            this.cdr.markForCheck();
        });
    }

    getPositionLabel(position?: string): string {
        if (!position) return '-';
        const labels: any = {
            'reves': 'Revés',
            'drive': 'Drive',
            'mixto': 'Mixto'
        };
        return labels[position] || position;
    }
}
