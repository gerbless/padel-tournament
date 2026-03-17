import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { StatsDashboardComponent } from './components/stats-dashboard/stats-dashboard.component';
import { PersonalTrackerService, PersonalMatch } from '../../services/personal-tracker.service';
import { ToastService } from '../../services/toast.service';
import { ConfirmService } from '../../services/confirm.service';

@Component({
    selector: 'app-personal-tracker',
    standalone: true,
    imports: [CommonModule, RouterModule, StatsDashboardComponent],
    templateUrl: './personal-tracker.component.html',
    styleUrls: ['./personal-tracker.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class PersonalTrackerComponent implements OnInit {
    inProgressMatches: PersonalMatch[] = [];
    loading = false;
    deletingMatchId: string | null = null;

    constructor(
        private trackerService: PersonalTrackerService,
        private router: Router,
        private cdr: ChangeDetectorRef,
        private toast: ToastService,
        private confirmService: ConfirmService
    ) { }

    ngOnInit() {
        this.loadInProgressMatches();
    }

    loadInProgressMatches() {
        this.loading = true;
        this.trackerService.getInProgress().subscribe({
            next: (matches) => {
                this.inProgressMatches = matches;
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (err: any) => {
                console.error('Error loading in-progress matches:', err);
                this.loading = false;
                this.cdr.markForCheck();
            }
        });
    }

    editMatch(matchId: string) {
        this.router.navigate(['/personal-tracker/edit', matchId]);
    }

    async deleteMatch(matchId: string) {
        if (this.deletingMatchId) return;
        const ok = await this.confirmService.confirm({
            title: 'Eliminar Partido',
            message: '¿Estás seguro de eliminar este partido?',
            confirmText: 'Eliminar'
        });
        if (!ok) return;

        this.deletingMatchId = matchId;
        this.cdr.markForCheck();
        this.trackerService.deleteMatch(matchId).subscribe({
            next: () => { this.deletingMatchId = null; this.loadInProgressMatches(); this.toast.success('Partido eliminado'); },
            error: () => { this.deletingMatchId = null; this.toast.error('Error al eliminar el partido'); this.cdr.markForCheck(); }
        });
    }

    getStatusLabel(status?: string): string {
        switch (status) {
            case 'draft': return '📝 Borrador';
            case 'in_progress': return '⏳ En Progreso';
            default: return status || '';
        }
    }
}
