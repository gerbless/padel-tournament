import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlayerService, Player } from '../../services/player.service';
import { ClubService } from '../../services/club.service';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-ranking',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './ranking.component.html',
    styleUrls: ['./ranking.component.css']
})
export class RankingComponent implements OnInit, OnDestroy {
    players: Player[] = [];
    filteredPlayers: (Player & { rank: number })[] = [];
    loading = true;
    searchTerm = '';
    currentClubId: string | undefined;
    private clubSubscription: Subscription | undefined;

    constructor(
        private playerService: PlayerService,
        private clubService: ClubService
    ) { }

    ngOnInit() {
        this.clubSubscription = this.clubService.selectedClub$.subscribe(club => {
            this.currentClubId = club?.id;
            this.loadRanking();
        });
    }

    ngOnDestroy() {
        this.clubSubscription?.unsubscribe();
    }

    loadRanking() {
        this.loading = true;
        this.playerService.getRanking(undefined, this.currentClubId).subscribe({
            next: (players) => {
                this.players = players;
                this.filterPlayers();
                this.loading = false;
            },
            error: (error) => {
                console.error('Error loading ranking:', error);
                this.loading = false;
            }
        });
    }

    filterPlayers() {
        let result = this.players;
        if (this.searchTerm) {
            const term = this.searchTerm.toLowerCase();
            result = this.players.filter(p =>
                p.name.toLowerCase().includes(term)
            );
        }
        this.filteredPlayers = this.calculateRanks(result);
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
}
