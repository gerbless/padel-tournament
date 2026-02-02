import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { StatsDashboardComponent } from './components/stats-dashboard/stats-dashboard.component';
import { PersonalTrackerService, PersonalMatch } from '../../services/personal-tracker.service';

@Component({
    selector: 'app-personal-tracker',
    standalone: true,
    imports: [CommonModule, RouterModule, StatsDashboardComponent],
    templateUrl: './personal-tracker.component.html',
    styleUrls: ['./personal-tracker.component.css']
})
export class PersonalTrackerComponent implements OnInit {
    inProgressMatches: PersonalMatch[] = [];
    loading = false;

    constructor(
        private trackerService: PersonalTrackerService,
        private router: Router
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
            },
            error: (err: any) => {
                console.error('Error loading in-progress matches:', err);
                this.loading = false;
            }
        });
    }

    editMatch(matchId: string) {
        this.router.navigate(['/personal-tracker/edit', matchId]);
    }

    deleteMatch(matchId: string) {
        if (confirm('¿Estás seguro de eliminar este partido?')) {
            // TODO: Implementar eliminación
            console.log('Delete match:', matchId);
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
