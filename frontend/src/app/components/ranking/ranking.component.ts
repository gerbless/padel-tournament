import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlayerService, Player } from '../../services/player.service';

@Component({
    selector: 'app-ranking',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './ranking.component.html',
    styleUrls: ['./ranking.component.css']
})
export class RankingComponent implements OnInit {
    players: Player[] = [];
    filteredPlayers: Player[] = [];
    loading = true;
    searchTerm = '';

    constructor(private playerService: PlayerService) { }

    ngOnInit() {
        this.loadRanking();
    }

    loadRanking() {
        this.loading = true;
        this.playerService.getRanking().subscribe({
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
        if (!this.searchTerm) {
            this.filteredPlayers = this.players;
        } else {
            const term = this.searchTerm.toLowerCase();
            this.filteredPlayers = this.players.filter(p =>
                p.name.toLowerCase().includes(term)
            );
        }
    }
}
