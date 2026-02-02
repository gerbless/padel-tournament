import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ClubService } from '../../services/club.service';
import { Club } from '../../models/club.model';
import { Player } from '../../services/player.service';

@Component({
    selector: 'app-club-selection',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './club-selection.component.html',
    styleUrls: ['./club-selection.component.css']
})
export class ClubSelectionComponent implements OnInit {
    clubs: Club[] = [];
    globalTopPlayers: (Player & { rank: number })[] = [];
    loading = true;
    searchTerm = '';

    constructor(
        private clubService: ClubService,
        private router: Router
    ) { }

    ngOnInit(): void {
        this.loadClubs();
        this.loadGlobalTopPlayers();
    }

    loadClubs(): void {
        this.clubService.getClubs().subscribe({
            next: (clubs) => {
                this.clubs = clubs;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading clubs:', err);
                this.loading = false;
            }
        });
    }

    loadGlobalTopPlayers(): void {
        this.clubService.getTopPlayersGlobal().subscribe({
            next: (players) => {
                this.globalTopPlayers = this.calculateRanks(players);
            },
            error: (err) => {
                console.error('Error loading global top players:', err);
            }
        });
    }

    private calculateRanks(players: Player[]): (Player & { rank: number })[] {
        const rankedPlayers: (Player & { rank: number })[] = [];
        for (let i = 0; i < players.length; i++) {
            let rank = i + 1;
            if (i > 0 && players[i].totalPoints === players[i - 1].totalPoints) {
                rank = rankedPlayers[i - 1].rank;
            }
            rankedPlayers.push({ ...players[i], rank });
        }
        return rankedPlayers;
    }

    showAll = false;
    readonly MAX_VISIBLE = 6;

    get filteredClubs(): Club[] {
        if (!this.searchTerm) {
            return this.showAll ? this.clubs : this.clubs.slice(0, this.MAX_VISIBLE);
        }
        return this.clubs.filter(club =>
            club.name.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
    }

    toggleShowAll(): void {
        this.showAll = !this.showAll;
    }

    selectClub(club: Club): void {
        this.clubService.selectClub(club);
        this.router.navigate(['/dashboard']);
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
