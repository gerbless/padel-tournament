import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { CategoryService } from '../../services/category.service';
import { PlayerService } from '../../../../services/player.service';

@Component({
    selector: 'app-promotion-dashboard',
    templateUrl: './promotion-dashboard.component.html',
    styleUrls: ['./promotion-dashboard.component.css'],
    standalone: true,
    imports: [CommonModule]
})
export class PromotionDashboardComponent implements OnInit {
    analysis: { promotions: any[], relegations: any[] } = { promotions: [], relegations: [] };
    loading = false;

    constructor(
        private categoryService: CategoryService,
        private playerService: PlayerService
    ) { }

    ngOnInit(): void {
        this.loadAnalysis();
    }

    loadAnalysis() {
        this.loading = true;
        this.categoryService.getAnalysis().subscribe(data => {
            this.analysis = data;
            this.loading = false;
        });
    }

    applyChange(item: any, type: 'promotion' | 'relegation') {
        if (!confirm(`¿Aplicar cambio de categoría para ${item.player}?`)) return;

        // We need the Category entity or ID. The analysis returns "suggestedCategory" (name).
        // Ideally backend returns ID. Let's assume backend returns name for display.
        // We need to fetch categories to find ID? Or update backend to return ID.
        // Creating a quick lookup is better.

        this.categoryService.findAll().subscribe(categories => {
            const targetCategory = categories.find(c => c.name === item.suggestedCategory);
            if (targetCategory && targetCategory.id) {
                // Find player by ID? The analysis should return player ID too!
                // Updating backend service to return player ID is needed.
                // For now, let's assume item has .player (name). We need ID.
                // Wait, looking at backend service:
                // promotions.push({ player: player.name, ... }) -> It ONLY returns name!
                // I need to fix Backend Service to return Player ID.

                // I will fix Backend Service first? Or just do it now in parallel?
                // Proceeding assuming I will fix backend to return playerId.

                this.playerService.updatePlayer(item.playerId, { category: targetCategory.id }).subscribe(() => {
                    this.loadAnalysis(); // Reload to remove item
                });
            }
        });
    }
}
