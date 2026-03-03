import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { CourtService } from '../../../../services/court.service';
import { ClubService } from '../../../../services/club.service';
import { AuthService } from '../../../../services/auth.service';
import { BillingDashboard, CourtBilling, BillingTotals, MonthlyTrend } from '../../../../models/court.model';

@Component({
    selector: 'app-court-billing',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    templateUrl: './court-billing.component.html',
    styleUrls: ['./court-billing.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class CourtBillingComponent implements OnInit {
    clubId = '';
    clubName = '';
    loading = true;

    selectedYear: number;
    selectedMonth: number | null = null;
    availableYears: number[] = [];

    dashboard: BillingDashboard | null = null;
    courts: CourtBilling[] = [];
    totals: BillingTotals = {
        totalReservations: 0, paidCount: 0, partialCount: 0, pendingCount: 0,
        totalRevenue: 0, paidRevenue: 0, partialRevenue: 0, pendingRevenue: 0,
        collectedRevenue: 0, owedRevenue: 0
    };
    monthlyTrend: MonthlyTrend[] = [];
    chartMaxRevenue = 0;

    monthNames = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    monthFullNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    constructor(
        private courtService: CourtService,
        private clubService: ClubService,
        private authService: AuthService,
        private cdr: ChangeDetectorRef
    ) {
        const now = new Date();
        this.selectedYear = now.getFullYear();
        for (let y = now.getFullYear(); y >= now.getFullYear() - 5; y--) {
            this.availableYears.push(y);
        }
    }

    ngOnInit() {
        this.clubService.selectedClub$.subscribe(club => {
            if (club) {
                this.clubId = club.id;
                this.clubName = club.name;
                this.loadBilling();
            }
        });
    }

    loadBilling() {
        this.loading = true;
        this.cdr.markForCheck();

        this.courtService.getBillingDashboard(
            this.clubId,
            this.selectedYear,
            this.selectedMonth || undefined
        ).subscribe({
            next: (data) => {
                this.dashboard = data;
                this.courts = data.courts.map(c => ({
                    ...c,
                    totalReservations: +c.totalReservations,
                    paidCount: +c.paidCount,
                    partialCount: +c.partialCount,
                    pendingCount: +c.pendingCount,
                    totalRevenue: +c.totalRevenue,
                    paidRevenue: +c.paidRevenue,
                    partialRevenue: +c.partialRevenue,
                    pendingRevenue: +c.pendingRevenue,
                    collectedRevenue: +(c as any).collectedRevenue || 0,
                    owedRevenue: +(c as any).owedRevenue || 0
                }));
                this.totals = {
                    totalReservations: +data.totals.totalReservations || 0,
                    paidCount: +data.totals.paidCount || 0,
                    partialCount: +data.totals.partialCount || 0,
                    pendingCount: +data.totals.pendingCount || 0,
                    totalRevenue: +data.totals.totalRevenue || 0,
                    paidRevenue: +data.totals.paidRevenue || 0,
                    partialRevenue: +data.totals.partialRevenue || 0,
                    pendingRevenue: +data.totals.pendingRevenue || 0,
                    collectedRevenue: +(data.totals as any).collectedRevenue || 0,
                    owedRevenue: +(data.totals as any).owedRevenue || 0
                };
                this.monthlyTrend = data.monthlyTrend.map(m => ({
                    ...m,
                    month: +m.month,
                    totalRevenue: +m.totalRevenue,
                    paidRevenue: +m.paidRevenue,
                    pendingRevenue: +m.pendingRevenue,
                    partialRevenue: +m.partialRevenue,
                    totalReservations: +m.totalReservations
                }));
                this.chartMaxRevenue = Math.max(
                    ...this.monthlyTrend.map(m => m.totalRevenue),
                    1
                );
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: () => {
                this.loading = false;
                this.cdr.markForCheck();
            }
        });
    }

    onFilterChange() {
        this.loadBilling();
    }

    clearMonth() {
        this.selectedMonth = null;
        this.loadBilling();
    }

    // ── Formatting helpers ───────────────────────────

    formatCurrency(value: number): string {
        if (!value && value !== 0) return '$0';
        return new Intl.NumberFormat('es', { style: 'currency', currency: 'CLP', maximumFractionDigits: 0 }).format(value);
    }

    formatNumber(value: number): string {
        return new Intl.NumberFormat('es').format(value);
    }

    getCollectionRate(): number {
        if (!this.totals.totalRevenue) return 0;
        return Math.round((this.totals.collectedRevenue / this.totals.totalRevenue) * 100);
    }

    getBarHeight(value: number): string {
        if (!this.chartMaxRevenue) return '0%';
        return Math.max((value / this.chartMaxRevenue) * 100, 2) + '%';
    }

    getMonthTrend(monthNum: number): MonthlyTrend | null {
        return this.monthlyTrend.find(m => m.month === monthNum) || null;
    }

    // Fill all 12 months for chart
    get chartMonths(): { month: number; label: string; data: MonthlyTrend }[] {
        return Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const data = this.monthlyTrend.find(t => t.month === m) || {
                month: m, totalRevenue: 0, paidRevenue: 0, pendingRevenue: 0, partialRevenue: 0, totalReservations: 0
            };
            return { month: m, label: this.monthNames[i], data };
        });
    }

    getCourtCollectionRate(court: CourtBilling): number {
        if (!court.totalRevenue) return 0;
        return Math.round((court.collectedRevenue / court.totalRevenue) * 100);
    }

    getPeriodLabel(): string {
        if (this.selectedMonth) {
            return `${this.monthFullNames[this.selectedMonth - 1]} ${this.selectedYear}`;
        }
        return `Año ${this.selectedYear}`;
    }
}
