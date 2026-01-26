import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { PlayerService, Player } from '../../services/player.service';

@Component({
    selector: 'app-player-profile',
    standalone: true,
    imports: [CommonModule, RouterLink],
    templateUrl: './player-profile.component.html',
    styleUrls: ['./player-profile.component.css']
})
export class PlayerProfileComponent implements OnInit {
    player: Player | null = null;
    loading = true;

    constructor(
        private route: ActivatedRoute,
        private playerService: PlayerService
    ) { }

    ngOnInit() {
        const id = this.route.snapshot.paramMap.get('id');
        if (id) {
            this.loadPlayer(id);
        }
    }

    loadPlayer(id: string) {
        this.playerService.findAll().subscribe(players => {
            this.player = players.find(p => p.id === id) || null;
            this.loading = false;
        });
        // Note: Ideally backend should have findOne with enriched data, 
        // but findAll is cached/fast enough for now given current service structure.
    }

    getInitials(name: string): string {
        return name
            .split(' ')
            .map(n => n[0])
            .slice(0, 2)
            .join('')
            .toUpperCase();
    }

    getWinRate(): number {
        if (!this.player || this.player.tournamentsPlayed === 0) return 0;
        // Approximation: Matches Played is not directly stored on player entity in simple form
        // But we have matchesWon. Let's assume average matches per tournament is 3.
        // Or just show raw stats.
        return 0; // Placeholder until backend enrichment
    }
}
