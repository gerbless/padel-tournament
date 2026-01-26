import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartOptions } from 'chart.js';
import { PlayerService, Player } from '../../services/player.service';
import { TournamentService, Tournament } from '../../services/tournament.service';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, NgChartsModule],
    templateUrl: './dashboard.component.html',
    styleUrls: ['./dashboard.component.css']
})
export class DashboardComponent implements OnInit {
    // Stats
    totalPlayers = 0;
    totalTournaments = 0;
    activeTournaments = 0;
    totalMatches = 0;

    // Charts
    public barChartLegend = true;
    public barChartPlugins = [];

    public barChartData: ChartConfiguration<'bar'>['data'] = {
        labels: [],
        datasets: [
            { data: [], label: 'Puntos de Ranking', backgroundColor: 'rgba(16, 185, 129, 0.8)' }
        ]
    };

    public barChartOptions: ChartConfiguration<'bar'>['options'] = {
        responsive: true,
        plugins: {
            legend: { display: true },
            title: { display: true, text: 'Top 5 Justadores' }
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

    constructor(
        private playerService: PlayerService,
        private tournamentService: TournamentService
    ) { }

    ngOnInit() {
        this.loadStats();
    }

    loadStats() {
        // Load Players for Ranking Chart
        this.playerService.getRanking().subscribe(players => {
            this.totalPlayers = players.length;

            // Top 5
            const top5 = players.slice(0, 5);
            this.barChartData.labels = top5.map(p => p.name);
            this.barChartData.datasets[0].data = top5.map(p => p.totalPoints);

            // Re-trigger chart update (hacky reset for Angular charts sometimes needed)
            this.barChartData = { ...this.barChartData };

            // Points Distribution: Top 10 vs Rest
            const top10Points = players.slice(0, 10).reduce((acc, p) => acc + p.totalPoints, 0);
            const restPoints = players.slice(10).reduce((acc, p) => acc + p.totalPoints, 0);

            this.pieChartData.labels = ['Top 10 Puntos', 'Resto del Mundo'];
            this.pieChartData.datasets[0].data = [top10Points, restPoints];
            this.pieChartData.datasets[0].backgroundColor = ['rgba(255, 193, 7, 0.8)', 'rgba(52, 211, 153, 0.8)']; // Gold vs Emerald
            this.pieChartData = { ...this.pieChartData };
        });

        // Load Tournaments
        this.tournamentService.getTournaments().subscribe((tournaments: Tournament[]) => {
            this.totalTournaments = tournaments.length;
            this.activeTournaments = tournaments.filter(t => t.status !== 'completed').length;

            // Calculate total COMPLETED matches across all tournaments
            this.totalMatches = tournaments.reduce((acc, t) => {
                if (t.matches) {
                    return acc + t.matches.filter(m => m.status === 'completed').length;
                }
                return acc;
            }, 0);
        });
    }
}
