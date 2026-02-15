import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoryService } from '../../services/category.service';
import { PlayerService } from '../../../../services/player.service';
import { AuthService } from '../../../../services/auth.service';
import { ToastService } from '../../../../services/toast.service';
import { ClubService } from '../../../../services/club.service';

@Component({
    selector: 'app-promotion-dashboard',
    templateUrl: './promotion-dashboard.component.html',
    styleUrls: ['./promotion-dashboard.component.css'],
    standalone: true,
    imports: [CommonModule],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PromotionDashboardComponent implements OnInit {
    analysis: { promotions: any[], relegations: any[] } = { promotions: [], relegations: [] };
    loading = false;
    isLoggedIn = false;
    canAdmin = false;

    constructor(
        private categoryService: CategoryService,
        private playerService: PlayerService,
        private cdr: ChangeDetectorRef,
        private toast: ToastService,
        private authService: AuthService,
        private clubService: ClubService
    ) { }

    ngOnInit(): void {
        this.isLoggedIn = this.authService.isAuthenticated();
        const club = this.clubService.getSelectedClub();
        if (club) {
            this.canAdmin = this.authService.hasClubRole(club.id, 'admin');
        }
        this.loadAnalysis();
    }

    loadAnalysis() {
        this.loading = true;
        this.categoryService.getAnalysis().subscribe(data => {
            this.analysis = data;
            this.loading = false;
            this.cdr.markForCheck();
        });
    }

    applyChange(item: any, type: 'promotion' | 'relegation') {
        if (!confirm(`¿Aplicar cambio de categoría para ${item.player}?`)) return;

        if (!item.playerId || !item.suggestedCategoryId) {
            console.error('Missing playerId or suggestedCategoryId in analysis item');
            return;
        }

        this.playerService.updatePlayer(item.playerId, { categoryId: item.suggestedCategoryId }).subscribe({
            next: () => { this.loadAnalysis(); this.toast.success(`Categoría de ${item.player} actualizada`); },
            error: () => this.toast.error('Error al aplicar el cambio de categoría')
        });
    }
}
