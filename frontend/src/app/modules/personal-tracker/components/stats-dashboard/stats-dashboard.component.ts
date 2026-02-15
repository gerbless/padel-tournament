import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { NgChartsModule } from 'ng2-charts';
import { ChartConfiguration, ChartData, ChartType } from 'chart.js';
import { PersonalTrackerService } from '../../../../services/personal-tracker.service';

@Component({
    selector: 'app-stats-dashboard',
    standalone: true,
    imports: [CommonModule, NgChartsModule],
    templateUrl: './stats-dashboard.component.html',
    styleUrls: ['./stats-dashboard.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class StatsDashboardComponent implements OnInit {
    stats: any = null;
    loading = true;

    // Category Performance Chart
    categoryChartData: ChartData<'bar'> = {
        labels: [],
        datasets: [
            {
                data: [],
                label: '% Victoria',
                backgroundColor: 'rgba(16, 185, 129, 0.7)',
                borderColor: 'rgba(16, 185, 129, 1)',
                borderWidth: 2
            }
        ]
    };

    categoryChartOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: true,
                text: 'Rendimiento por Categoría de Rivales',
                color: '#fff',
                font: {
                    size: 16,
                    weight: 'bold'
                }
            },
            tooltip: {
                callbacks: {
                    label: (context: any) => {
                        const value = context.parsed.y as number;
                        const index = context.dataIndex;
                        const stat = this.stats.categoryPerformance[index];
                        if (!stat) return '';
                        return [
                            `Win Rate: ${value.toFixed(1)}%`,
                            `Victorias: ${stat.wins}`,
                            `Derrotas: ${stat.losses}`,
                            `Total: ${stat.played} partidos`
                        ];
                    }
                }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                max: 100,
                ticks: {
                    color: '#9ca3af',
                    callback: (value: any) => value + '%'
                },
                grid: {
                    color: 'rgba(255,255,255,0.1)'
                }
            },
            x: {
                ticks: {
                    color: '#9ca3af'
                },
                grid: {
                    display: false
                }
            }
        }
    };

    categoryChartType: ChartType = 'bar';

    // Evolution Chart
    evolutionChartData: ChartData<'line'> = {
        labels: [],
        datasets: [
            {
                data: [],
                label: 'Rating',
                fill: true,
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderColor: 'rgba(59, 130, 246, 1)',
                borderWidth: 2,
                tension: 0.4,
                pointBackgroundColor: 'rgba(59, 130, 246, 1)',
                pointBorderColor: '#fff',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6
            }
        ]
    };

    evolutionChartOptions: ChartConfiguration['options'] = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: false
            },
            title: {
                display: true,
                text: 'Evolución de Rating',
                color: '#fff',
                font: {
                    size: 16,
                    weight: 'bold'
                }
            }
        },
        scales: {
            y: {
                ticks: {
                    color: '#9ca3af'
                },
                grid: {
                    color: 'rgba(255,255,255,0.1)'
                }
            },
            x: {
                ticks: {
                    color: '#9ca3af',
                    maxRotation: 45,
                    minRotation: 45
                },
                grid: {
                    display: false
                }
            }
        }
    };

    evolutionChartType: ChartType = 'line';

    constructor(private trackerService: PersonalTrackerService, private cdr: ChangeDetectorRef) { }

    ngOnInit() {
        this.loadStats();
    }

    loadStats() {
        this.loading = true;
        this.trackerService.getStats().subscribe({
            next: (data: any) => {
                this.stats = data;
                this.prepareCharts();
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (err: any) => {
                console.error('Error loading stats', err);
                this.loading = false;
                this.cdr.markForCheck();
            }
        });
    }

    prepareCharts() {
        // Category Performance Chart
        if (this.stats.categoryPerformance && this.stats.categoryPerformance.length > 0) {
            this.categoryChartData.labels = this.stats.categoryPerformance.map((c: any) => c.category);
            this.categoryChartData.datasets[0].data = this.stats.categoryPerformance.map((c: any) => c.winRate);
        }

        // Evolution Chart
        if (this.stats.evolution && this.stats.evolution.length > 0) {
            this.evolutionChartData.labels = this.stats.evolution.map((e: any) =>
                new Date(e.date).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
            );
            this.evolutionChartData.datasets[0].data = this.stats.evolution.map((e: any) => e.points);
        }
    }

    getStreakIcon() {
        if (!this.stats || this.stats.streakType === 'none') return '➖';
        return this.stats.streakType === 'win' ? '🔥' : '❄️';
    }

    getStreakClass() {
        if (!this.stats || this.stats.streakType === 'none') return 'neutral';
        return this.stats.streakType === 'win' ? 'positive' : 'negative';
    }
}
