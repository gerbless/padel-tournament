import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TournamentService, Tournament } from '../../services/tournament.service';

@Component({
    selector: 'app-tournament-list',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './tournament-list.component.html',
    styleUrls: ['./tournament-list.component.css']
})
export class TournamentListComponent implements OnInit {
    tournaments: Tournament[] = [];
    loading = true;

    constructor(private tournamentService: TournamentService) { }

    ngOnInit() {
        this.loadTournaments();
    }

    loadTournaments() {
        this.loading = true;
        this.tournamentService.getTournaments().subscribe({
            next: (tournaments) => {
                this.tournaments = tournaments;
                this.loading = false;
            },
            error: (error) => {
                console.error('Error loading tournaments:', error);
                this.loading = false;
            }
        });
    }

    getTeamCount(type: string): number {
        return type === 'cuadrangular' ? 4 : 6;
    }

    getStatusBadgeClass(status: string): string {
        switch (status) {
            case 'completed':
                return 'badge-success';
            case 'in_progress':
                return 'badge-info';
            default:
                return 'badge-warning';
        }
    }

    getStatusText(status: string): string {
        switch (status) {
            case 'completed':
                return 'Completado';
            case 'in_progress':
                return 'En Progreso';
            default:
                return 'Borrador';
        }
    }

    deleteTournament(id: string, event: Event) {
        event.preventDefault();
        event.stopPropagation();

        if (confirm('¿Estás seguro de eliminar este torneo?')) {
            this.tournamentService.deleteTournament(id).subscribe({
                next: () => this.loadTournaments(),
                error: (error) => console.error('Error deleting tournament:', error)
            });
        }
    }
}
