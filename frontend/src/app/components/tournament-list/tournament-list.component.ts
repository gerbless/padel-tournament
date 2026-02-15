import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { TournamentService, Tournament } from '../../services/tournament.service';
import { ClubService } from '../../services/club.service';
import { Subscription } from 'rxjs';
import { ToastService } from '../../services/toast.service';

import { AuthService } from '../../services/auth.service';

@Component({
    selector: 'app-tournament-list',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './tournament-list.component.html',
    styleUrls: ['./tournament-list.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class TournamentListComponent implements OnInit, OnDestroy {
    tournaments: Tournament[] = [];
    loading = true;
    currentClubName: string = '';
    isLoggedIn = false;
    canEdit = false;
    canAdmin = false;
    private clubSubscription?: Subscription;

    // Month/year filter
    selectedMonth: number;
    selectedYear: number;
    showAll = false;
    monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

    // Grouped view for "show all"
    groupedTournaments: { label: string; tournaments: Tournament[] }[] = [];

    constructor(
        private tournamentService: TournamentService,
        private clubService: ClubService,
        private authService: AuthService,
        private cdr: ChangeDetectorRef,
        private toast: ToastService
    ) {
        const now = new Date();
        this.selectedMonth = now.getMonth() + 1;
        this.selectedYear = now.getFullYear();
    }

    ngOnInit() {
        this.isLoggedIn = this.authService.isAuthenticated();
        this.clubSubscription = this.clubService.selectedClub$.subscribe(club => {
            this.currentClubName = club?.name || 'Todos los clubs';
            this.canEdit = club ? this.authService.hasClubRole(club.id, 'editor') : false;
            this.canAdmin = club ? this.authService.hasClubRole(club.id, 'admin') : false;
            this.cdr.markForCheck();
            this.loadTournaments();
        });
    }

    ngOnDestroy() {
        this.clubSubscription?.unsubscribe();
    }

    // ===================== MONTH NAVIGATION =====================
    prevMonth() {
        if (this.selectedMonth === 1) {
            this.selectedMonth = 12;
            this.selectedYear--;
        } else {
            this.selectedMonth--;
        }
        this.loadTournaments();
    }

    nextMonth() {
        if (this.selectedMonth === 12) {
            this.selectedMonth = 1;
            this.selectedYear++;
        } else {
            this.selectedMonth++;
        }
        this.loadTournaments();
    }

    toggleShowAll() {
        this.showAll = !this.showAll;
        this.loadTournaments();
    }

    // ===================== LOAD =====================
    loadTournaments() {
        this.loading = true;
        const clubId = this.clubService.getSelectedClub()?.id;
        const month = this.showAll ? undefined : this.selectedMonth;
        const year = this.showAll ? undefined : this.selectedYear;

        this.tournamentService.getTournaments(clubId, month, year).subscribe({
            next: (tournaments) => {
                this.tournaments = tournaments;
                this.buildGroups();
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (error) => {
                console.error('Error loading tournaments:', error);
                this.loading = false;
                this.cdr.markForCheck();
            }
        });
    }

    buildGroups() {
        const groups = new Map<string, { label: string; tournaments: Tournament[] }>();
        for (const t of this.tournaments) {
            const d = new Date(t.createdAt);
            const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            if (!groups.has(key)) {
                groups.set(key, { label: `${this.monthNames[d.getMonth()]} ${d.getFullYear()}`, tournaments: [] });
            }
            groups.get(key)!.tournaments.push(t);
        }
        this.groupedTournaments = Array.from(groups.values());
    }

    // ===================== HELPERS =====================
    formatDate(dateStr: string): string {
        const d = new Date(dateStr);
        return d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    getTypeLabel(type: string): string {
        const map: Record<string, string> = {
            cuadrangular: 'Cuadrangular', hexagonal: 'Hexagonal', octagonal: 'Octagonal',
            decagonal: 'Decagonal', dodecagonal: 'Dodecagonal'
        };
        return map[type] || type;
    }

    getStatusBadgeClass(status: string): string {
        switch (status) {
            case 'completed': return 'badge-success';
            case 'in_progress': return 'badge-info';
            default: return 'badge-warning';
        }
    }

    getStatusText(status: string): string {
        switch (status) {
            case 'completed': return 'Completado';
            case 'in_progress': return 'En Progreso';
            default: return 'Borrador';
        }
    }

    deleteTournament(id: string, event: Event) {
        event.preventDefault();
        event.stopPropagation();

        if (confirm('¿Estás seguro de eliminar este torneo?')) {
            this.tournamentService.deleteTournament(id).subscribe({
                next: () => { this.loadTournaments(); this.toast.success('Torneo eliminado'); },
                error: () => this.toast.error('Error al eliminar el torneo')
            });
        }
    }
}
