import { Component, OnInit, OnDestroy, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { PlayerService, Player } from '../../services/player.service';
import { ClubService } from '../../services/club.service';
import { Subscription } from 'rxjs';

type RankingTab = 'global' | 'tournament' | 'league' | 'free-play';

@Component({
    selector: 'app-ranking',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './ranking.component.html',
    styleUrls: ['./ranking.component.css'],
    changeDetection: ChangeDetectionStrategy.OnPush
})
export class RankingComponent implements OnInit, OnDestroy {
    players: Player[] = [];
    filteredPlayers: (Player & { rank: number })[] = [];
    loading = true;
    searchTerm = '';
    currentClubId: string | undefined;
    activeTab: RankingTab = 'global';
    private clubSubscription: Subscription | undefined;

    tabs: { key: RankingTab; label: string; icon: string }[] = [
        { key: 'global', label: 'Global', icon: '🏆' },
        { key: 'tournament', label: 'Torneos', icon: '🎯' },
        { key: 'league', label: 'Ligas', icon: '📋' },
        { key: 'free-play', label: 'Juego Libre', icon: '🎾' },
    ];

    constructor(
        private playerService: PlayerService,
        private clubService: ClubService,
        private cdr: ChangeDetectorRef
    ) { }

    ngOnInit() {
        this.clubSubscription = this.clubService.selectedClub$.subscribe(club => {
            this.currentClubId = club?.id;
            this.cdr.markForCheck();
            this.loadRanking();
        });
    }

    ngOnDestroy() {
        this.clubSubscription?.unsubscribe();
    }

    switchTab(tab: RankingTab) {
        this.activeTab = tab;
        this.searchTerm = '';
        this.loadRanking();
    }

    loadRanking() {
        this.loading = true;
        this.cdr.markForCheck();
        let obs;
        switch (this.activeTab) {
            case 'tournament':
                obs = this.playerService.getTournamentRanking(undefined, this.currentClubId);
                break;
            case 'league':
                obs = this.playerService.getLeagueRanking(undefined, this.currentClubId);
                break;
            case 'free-play':
                obs = this.playerService.getFreePlayRanking(undefined, this.currentClubId);
                break;
            default:
                obs = this.playerService.getRanking(undefined, this.currentClubId);
        }
        obs.subscribe({
            next: (players) => {
                this.players = players;
                this.filterPlayers();
                this.loading = false;
                this.cdr.markForCheck();
            },
            error: (error) => {
                console.error('Error loading ranking:', error);
                this.loading = false;
                this.cdr.markForCheck();
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

    getPointsField(player: Player): number {
        switch (this.activeTab) {
            case 'tournament': return player.tournamentPoints || 0;
            case 'league': return player.leaguePoints || 0;
            case 'free-play': return player.freePlayPoints || 0;
            default: return player.totalPoints || 0;
        }
    }

    get pointsLabel(): string {
        switch (this.activeTab) {
            case 'tournament': return 'Pts Torneo';
            case 'league': return 'Pts Liga';
            case 'free-play': return 'Pts Juego Libre';
            default: return 'Puntos';
        }
    }

    get tabTitle(): string {
        const tab = this.tabs.find(t => t.key === this.activeTab);
        return tab ? `${tab.icon} Ranking ${tab.label}` : '🏆 Ranking Global';
    }

    private calculateRanks(players: Player[]): (Player & { rank: number })[] {
        const rankedPlayers: (Player & { rank: number })[] = [];
        let currentRank = 1;
        for (let i = 0; i < players.length; i++) {
            const pts = this.getPointsField(players[i]);
            if (i > 0 && pts < this.getPointsField(players[i - 1])) {
                currentRank++;
            }
            rankedPlayers.push({ ...players[i], rank: currentRank });
        }
        return rankedPlayers;
    }
}
