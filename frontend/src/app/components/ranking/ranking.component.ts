import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PlayerService, Player } from '../../services/player.service';

@Component({
    selector: 'app-ranking',
    standalone: true,
    imports: [CommonModule],
    templateUrl: './ranking.component.html',
    styleUrls: ['./ranking.component.css']
})
export class RankingComponent implements OnInit {
    players: Player[] = [];
    loading = true;

    constructor(private playerService: PlayerService) { }

    ngOnInit() {
        this.loadRanking();
    }

    loadRanking() {
        this.loading = true;
        this.playerService.getRanking().subscribe({
            next: (players) => {
                this.players = players;
                this.loading = false;
            },
            error: (error) => {
                console.error('Error loading ranking:', error);
                this.loading = false;
            }
        });
    }
}
