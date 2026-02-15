import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { LeagueService } from '../../services/league.service';
import { League } from '../../../../models/league.model';

import { AuthService } from '../../../../services/auth.service';
import { ToastService } from '../../../../services/toast.service';
import { ClubService } from '../../../../services/club.service';

@Component({
    selector: 'app-league-list',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './league-list.component.html',
    styleUrls: ['./league-list.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class LeagueListComponent implements OnInit {
    leagues: League[] = [];
    loading = false;
    isLoggedIn = false;
    canEdit = false;
    canAdmin = false;

    constructor(
        private leagueService: LeagueService,
        private authService: AuthService,
        private clubService: ClubService,
        private cdr: ChangeDetectorRef,
        private toast: ToastService
    ) { }

    ngOnInit() {
        this.isLoggedIn = this.authService.isAuthenticated();
        const club = this.clubService.getSelectedClub();
        if (club) {
            this.canEdit = this.authService.hasClubRole(club.id, 'editor');
            this.canAdmin = this.authService.hasClubRole(club.id, 'admin');
        }
        this.loadLeagues();
    }

    loadLeagues() {
        this.loading = true;
        this.leagueService.getLeagues().subscribe({
            next: (leagues: League[]) => {
                leagues.forEach((league: League) => this.normalizePairs(league));
                this.leagues = leagues;
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (err: any) => {
                console.error('Error loading leagues:', err);
                this.loading = false;
                this.cdr.markForCheck();
            }
        });
    }

    private normalizePairs(league: League) {
        if (league.teams && !league.pairs) {
            league.pairs = league.teams.map((team: any) => ({
                id: team.id,
                playerA: team.player1,
                playerB: team.player2,
                points: team.points || 0,
                wins: team.matchesWon || 0,
                draws: 0,
                losses: team.matchesLost || 0,
                setsWon: team.setsWon || 0,
                setsLost: team.setsLost || 0,
                gamesWon: team.gamesWon || 0,
                gamesLost: team.gamesLost || 0,
                matchHistory: [],
                groupId: team.group
            }));
        }
        if (!league.pairs) {
            league.pairs = [];
        }
    }

    // Delete Confirmation Modal
    showDeleteModal = false;
    leagueToDelete: string | null = null;
    deleting = false;

    deleteLeague(id: string) {
        this.leagueToDelete = id;
        this.showDeleteModal = true;
    }

    closeDeleteModal() {
        this.showDeleteModal = false;
        this.leagueToDelete = null;
    }

    confirmDelete() {
        if (!this.leagueToDelete) return;

        this.deleting = true;
        this.leagueService.deleteLeague(this.leagueToDelete).subscribe({
            next: () => {
                this.deleting = false;
                this.closeDeleteModal();
                this.loadLeagues();
                this.toast.success('Liga eliminada');
                this.cdr.markForCheck();
            },
            error: (err: any) => {
                this.toast.error('Error al eliminar la liga: ' + (err.error?.message || 'Error desconocido'));
                this.deleting = false;
                this.cdr.markForCheck();
            }
        });
    }

    getTypeLabel(type: string): string {
        return type === 'round_robin' ? 'Round Robin' : 'Grupos + Playoffs';
    }

    getStatusLabel(status: string): string {
        const labels: Record<string, string> = {
            'draft': 'Borrador',
            'active': 'Activa',
            'completed': 'Finalizada'
        };
        return labels[status] || status;
    }
}
