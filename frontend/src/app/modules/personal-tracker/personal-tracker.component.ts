import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { StatsDashboardComponent } from './components/stats-dashboard/stats-dashboard.component';
import { PersonalTrackerService, PersonalMatch } from '../../services/personal-tracker.service';
import { ToastService } from '../../services/toast.service';

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

    constructor(
        private trackerService: PersonalTrackerService,
        private router: Router,
        private cdr: ChangeDetectorRef,
        private toast: ToastService
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

    deleteMatch(matchId: string) {
        if (confirm('¿Estás seguro de eliminar este partido?')) {
            this.trackerService.deleteMatch(matchId).subscribe({
                next: () => { this.loadInProgressMatches(); this.toast.success('Partido eliminado'); },
                error: () => this.toast.error('Error al eliminar el partido')
            });
        }
    }

    getStatusLabel(status?: string): string {
        switch (status) {
            case 'draft': return '📝 Borrador';
            case 'in_progress': return '⏳ En Progreso';
            default: return status || '';
        }
    }
}
