import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { LeagueService } from '../../services/league.service';
import { CreateLeagueRequest, LeagueConfig } from '../../../../models/league.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';

interface Player {
    id: string;
    name: string;
}

@Component({
    selector: 'app-league-create',
    standalone: true,
    imports: [CommonModule, FormsModule],
    templateUrl: './league-create.component.html',
    styleUrls: ['./league-create.component.css']
})
export class LeagueCreateComponent implements OnInit {
    currentStep = 1;
    totalSteps = 5; // Changed from 4 to 5 to include pair configuration

    // Form data
    leagueName = '';
    leagueType: 'round_robin' | 'groups_playoff' | null = null;
    startDate = '';
    category = '';

    // Configuration
    config: LeagueConfig = {
        pointsWin: 3,
        pointsDraw: 1,
        pointsLoss: 0,
        setsToWin: 2,
        gamesPerSet: 6,
        tiebreakAt: 6,
        tiebreakInThirdSet: true,
        rounds: 1,
        numberOfGroups: 2,
        teamsAdvancePerGroup: 2,
        enableMultiTierPlayoffs: true
    };

    // Player selection
    availablePlayers: Player[] = [];
    selectedPlayerIds: string[] = [];
    searchTerm = '';

    // NEW: Pair configuration
    pairs: { playerA: string; playerB: string }[] = [];
    availableForPairing: string[] = [];
    manualPairA: string = '';
    manualPairB: string = '';

    // Loading states
    loading = false;
    creatingLeague = false;

    constructor(
        private leagueService: LeagueService,
        private router: Router,
        private http: HttpClient
    ) { }

    ngOnInit() {
        this.loadPlayers();
        this.setDefaultDate();
    }

    setDefaultDate() {
        const today = new Date();
        this.startDate = today.toISOString().split('T')[0];
    }

    loadPlayers() {
        this.loading = true;
        this.http.get<Player[]>(`${environment.apiUrl}/players`).subscribe({
            next: (players) => {
                this.availablePlayers = players;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading players:', err);
                this.loading = false;
            }
        });
    }

    get filteredPlayers() {
        if (!this.searchTerm) return this.availablePlayers;
        return this.availablePlayers.filter(p =>
            p.name.toLowerCase().includes(this.searchTerm.toLowerCase())
        );
    }

    togglePlayerSelection(playerId: string) {
        const index = this.selectedPlayerIds.indexOf(playerId);
        if (index > -1) {
            this.selectedPlayerIds.splice(index, 1);
        } else {
            this.selectedPlayerIds.push(playerId);
        }
    }

    isPlayerSelected(playerId: string): boolean {
        return this.selectedPlayerIds.includes(playerId);
    }

    // NEW: Pair configuration methods
    generateRandomPairs() {
        this.pairs = [];
        this.availableForPairing = [...this.selectedPlayerIds];

        // Shuffle players
        for (let i = this.availableForPairing.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [this.availableForPairing[i], this.availableForPairing[j]] =
                [this.availableForPairing[j], this.availableForPairing[i]];
        }

        // Create pairs
        while (this.availableForPairing.length >= 2) {
            const playerA = this.availableForPairing.shift()!;
            const playerB = this.availableForPairing.shift()!;
            this.pairs.push({ playerA, playerB });
        }
    }

    addManualPair(playerAId: string, playerBId: string) {
        if (playerAId === playerBId) {
            alert('No puedes emparejar un jugador consigo mismo');
            return;
        }
        this.pairs.push({ playerA: playerAId, playerB: playerBId });
        this.availableForPairing = this.availableForPairing.filter(
            id => id !== playerAId && id !== playerBId
        );
    }

    removePair(index: number) {
        const pair = this.pairs[index];
        this.availableForPairing.push(pair.playerA, pair.playerB);
        this.pairs.splice(index, 1);
    }

    getPlayerName(playerId: string): string {
        return this.availablePlayers.find(p => p.id === playerId)?.name || playerId;
    }

    nextStep() {
        if (this.validateCurrentStep()) {
            // When moving to step 4 (pair configuration), initialize available players
            if (this.currentStep === 3) {
                this.availableForPairing = [...this.selectedPlayerIds];
                this.pairs = [];
            }
            this.currentStep++;
        }
    }

    previousStep() {
        if (this.currentStep > 1) {
            this.currentStep--;
        }
    }

    validateCurrentStep(): boolean {
        switch (this.currentStep) {
            case 1:
                if (!this.leagueName || !this.leagueType) {
                    alert('Por favor completa el nombre y tipo de liga');
                    return false;
                }
                return true;
            case 2:
                if (!this.startDate) {
                    alert('Por favor selecciona una fecha de inicio');
                    return false;
                }
                return true;
            case 3:
                if (this.selectedPlayerIds.length < 4) {
                    alert('Selecciona al menos 4 jugadores (2 parejas)');
                    return false;
                }
                if (this.selectedPlayerIds.length % 2 !== 0) {
                    alert('Debes seleccionar un número par de jugadores');
                    return false;
                }
                return true;
            case 4:
                if (this.pairs.length < 2) {
                    alert('Debes formar al menos 2 parejas');
                    return false;
                }
                if (this.availableForPairing.length > 0) {
                    alert('Todos los jugadores deben estar en una pareja. Quedan ' + this.availableForPairing.length + ' jugadores sin emparejar.');
                    return false;
                }
                return true;
            default:
                return true;
        }
    }

    createLeague() {
        if (!this.validateCurrentStep()) return;

        this.creatingLeague = true;

        const request: any = {
            name: this.leagueName,
            type: this.leagueType!,
            startDate: this.startDate,
            category: this.category || undefined,
            config: {
                ...this.config,
                // Map to backend expected names
                pointsForWin: this.config.pointsWin,
                pointsForLoss: this.config.pointsLoss,
                pointsForDraw: this.config.pointsDraw,
                setsPerMatch: this.config.setsToWin, // setsToWin is '2' sets to win match (best of 3 usually)
                enableMultiTierPlayoffs: this.config.enableMultiTierPlayoffs
            },
            pairs: this.pairs // Send pairs instead of playerIds
        };

        this.leagueService.createLeague(request).subscribe({
            next: (league) => {
                this.creatingLeague = false;
                alert('Liga creada exitosamente');
                this.router.navigate(['/leagues', league.id]);
            },
            error: (err) => {
                console.error('Error creating league:', err);
                alert('Error al crear la liga: ' + (err.error?.message || err.message));
                this.creatingLeague = false;
            }
        });
    }

    get estimatedPairs(): number {
        return Math.floor(this.selectedPlayerIds.length / 2);
    }

    get estimatedMatches(): number {
        const pairs = this.estimatedPairs;
        if (this.leagueType === 'round_robin') {
            // n*(n-1)/2 * rounds
            return (pairs * (pairs - 1) / 2) * (this.config.rounds || 1);
        } else {
            // Groups + playoffs estimate
            const matchesPerGroup = (pairs / (this.config.numberOfGroups || 2)) *
                ((pairs / (this.config.numberOfGroups || 2)) - 1) / 2;
            const groupMatches = matchesPerGroup * (this.config.numberOfGroups || 2);
            const playoffMatches = 7; // QF(4) + SF(2) + F(1)
            return Math.ceil(groupMatches + playoffMatches);
        }
    }
}
