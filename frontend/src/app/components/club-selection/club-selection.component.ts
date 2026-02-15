import { Component, OnInit, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ClubService } from '../../services/club.service';
import { AuthService, ClubRole } from '../../services/auth.service';
import { Club } from '../../models/club.model';
import { Player } from '../../services/player.service';

@Component({
    selector: 'app-club-selection',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './club-selection.component.html',
    styleUrls: ['./club-selection.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class ClubSelectionComponent implements OnInit {
    clubs: Club[] = [];
    globalTopPlayers: (Player & { rank: number })[] = [];
    loading = true;
    searchTerm = '';
    isLoggedIn = false;
    clubRoles: ClubRole[] = [];
    isSuperAdmin = false;
    showOnlyMyClubs = false;

    constructor(
        private clubService: ClubService,
        private authService: AuthService,
        private router: Router,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit(): void {
        const user = this.authService.getCurrentUser();
        this.isLoggedIn = this.authService.isAuthenticated();
        this.isSuperAdmin = this.authService.isSuperAdmin();
        this.clubRoles = user?.clubRoles || [];
        // If user has club roles, default to showing only their clubs
        this.showOnlyMyClubs = this.isLoggedIn && this.clubRoles.length > 0 && !this.isSuperAdmin;
        this.loadClubs();
        this.loadGlobalTopPlayers();
    }

    loadClubs(): void {
        this.clubService.getClubs().subscribe({
            next: (clubs) => {
                this.clubs = clubs;
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (err) => {
                console.error('Error loading clubs:', err);
                this.loading = false;
                this.cdr.markForCheck();
            }
        });
    }

    loadGlobalTopPlayers(): void {
        this.clubService.getTopPlayersGlobal().subscribe({
            next: (players) => {
                this.globalTopPlayers = this.calculateRanks(players);
                this.cdr.markForCheck();
            },
            error: (err) => {
                console.error('Error loading global top players:', err);
            }
        });
    }

    private calculateRanks(players: Player[]): (Player & { rank: number })[] {
        const rankedPlayers: (Player & { rank: number })[] = [];
        let currentRank = 1;
        for (let i = 0; i < players.length; i++) {
            if (i > 0 && players[i].totalPoints < players[i - 1].totalPoints) {
                currentRank++;
            }
            rankedPlayers.push({ ...players[i], rank: currentRank });
        }
        return rankedPlayers;
    }

    showAll = false;
    readonly MAX_VISIBLE = 6;

    get filteredClubs(): Club[] {
        let result = this.clubs;

        // Filter by user's clubs if toggled
        if (this.showOnlyMyClubs && this.clubRoles.length > 0) {
            const myClubIds = new Set(this.clubRoles.map(r => r.clubId));
            result = result.filter(c => myClubIds.has(c.id));
        }

        // Filter by search
        if (this.searchTerm) {
            result = result.filter(club =>
                club.name.toLowerCase().includes(this.searchTerm.toLowerCase())
            );
        } else if (!this.showAll) {
            result = result.slice(0, this.MAX_VISIBLE);
        }

        return result;
    }

    toggleShowAll(): void {
        this.showAll = !this.showAll;
    }

    toggleMyClubs(): void {
        this.showOnlyMyClubs = !this.showOnlyMyClubs;
    }

    selectClub(club: Club): void {
        this.clubService.selectClub(club);
        this.router.navigate(['/dashboard']);
    }

    getClubRoleBadge(clubId: string): string {
        if (this.isSuperAdmin) return '👑 Super Admin';
        const cr = this.clubRoles.find(r => r.clubId === clubId);
        if (!cr) return '';
        switch (cr.role) {
            case 'admin': return '🔑 Admin';
            case 'editor': return '✏️ Editor';
            case 'viewer': return '👁️ Viewer';
            default: return '';
        }
    }

    getPlayerInitials(name: string): string {
        return name
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    }
}
