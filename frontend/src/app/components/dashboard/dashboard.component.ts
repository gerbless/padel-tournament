import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { PlayerService, Player } from '../../services/player.service';
import { TournamentService, Tournament } from '../../services/tournament.service';
import { LeagueService } from '../../modules/league/services/league.service';
import { League } from '../../models/league.model';
import { CategoryService } from '../../modules/categories/services/category.service';
import { FormsModule } from '@angular/forms'; // Need FormsModule for ngModel

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, NgChartsModule, FormsModule],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css']
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

    constructor(
        private playerService: PlayerService,
        private tournamentService: TournamentService,
        private leagueService: LeagueService,
        private categoryService: CategoryService // Added CategoryService to constructor
    ) { }

    ngOnInit() {
        this.loadCategories(); // Load categories on init
        this.loadStats();
    }

    loadCategories() {
        this.categoryService.findAll().subscribe(cats => {
            this.categories = cats;
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
        // 1. Recommended Matches
        this.playerService.getRecommendedMatches().subscribe(matches => {
            // Recommendation doesn't support category filtering yet on backend,
            // but for rankings it's critical.
            this.recommendedMatches = matches;
        });

        // 1b. Partner Recommendations
        this.playerService.getPartnerRecommendations().subscribe(partners => {
            this.partnerRecommendations = partners;
        });

        const catId = this.selectedCategoryId || undefined;

        // 2. Load Player Data
        this.playerService.getRanking(catId).subscribe(players => {
            this.totalPlayers = players.length;
            this.globalPlayers = players.slice(0, 10);

            // Points Distribution Update
            const top10Points = players.slice(0, 10).reduce((acc, p) => acc + p.totalPoints, 0);
            const restPoints = players.slice(10).reduce((acc, p) => acc + p.totalPoints, 0);

            this.pieChartData.labels = ['Top 10 Puntos', 'Resto del Mundo'];
            this.pieChartData.datasets[0].data = [top10Points, restPoints];
            this.pieChartData = { ...this.pieChartData };

            if (this.viewMode === 'players') this.updateCharts();
        });

        this.playerService.getLeagueRanking(catId).subscribe(players => {
            this.leaguePlayers = players.slice(0, 5);
            if (this.viewMode === 'players') this.updateCharts();
        });

        this.playerService.getTournamentRanking(catId).subscribe(players => {
            this.tournamentPlayers = players.slice(0, 5);
            if (this.viewMode === 'players') this.updateCharts();
        });

        // 2. Load Pair Data
        this.playerService.getPairRanking('global', catId).subscribe(pairs => {
            this.globalPairs = pairs.slice(0, 10);
            if (this.viewMode === 'pairs') this.updateCharts();
        });

        this.playerService.getPairRanking('league', catId).subscribe(pairs => {
            this.leaguePairs = pairs.slice(0, 5);
            if (this.viewMode === 'pairs') this.updateCharts();
        });

        this.playerService.getPairRanking('tournament', catId).subscribe(pairs => {
            this.tournamentPairs = pairs.slice(0, 5);
            if (this.viewMode === 'pairs') this.updateCharts();
        });

        // Load Tournaments & Leagues
        let matchesCount = 0;

        this.tournamentService.getTournaments().subscribe((tournaments: Tournament[]) => {
            this.totalTournaments = tournaments.length;
            this.activeTournaments = tournaments.filter(t => t.status !== 'completed').length;

            matchesCount += tournaments.reduce((acc, t) => {
                return acc + (t.matches ? t.matches.filter(m => m.status === 'completed').length : 0);
            }, 0);
            this.totalMatches = matchesCount;
        });

        this.leagueService.getLeagues().subscribe((leagues: League[]) => {
            this.totalLeagues = leagues.length;
            this.activeLeagues = leagues.filter(l => l.status !== 'completed').length;

            matchesCount += leagues.reduce((acc, l) => {
                return acc + (l.matches ? l.matches.filter(m => m.status === 'completed').length : 0);
            }, 0);
            this.totalMatches = matchesCount;
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
