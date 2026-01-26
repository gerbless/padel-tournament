import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { LeagueService, League } from '../../services/league.service';
import { PlayerService } from '../../services/player.service';

@Component({
    selector: 'app-league-dashboard',
    standalone: true,
    imports: [CommonModule, RouterModule, FormsModule],
    templateUrl: './league-dashboard.component.html',
    styleUrls: ['./league-dashboard.component.css']
})
export class LeagueDashboardComponent implements OnInit {
    leagueId: string | null = null;
    league: League | null = null;
    standings: any[] = []; // Grouped by groupName?
    fixtures: any[] = [];
    groupedStandings: { [key: string]: any[] } = {};
    groupedFixtures: { [key: number]: any[] } = {}; // Group by round
    players: any[] = [];
    selectedPlayer1: string | null = null;
    selectedPlayer2: string | null = null;
    showAddTeamModal = false;

    activeTab: 'standings' | 'fixtures' = 'standings';
    loading = true;

    // Match Result Modal
    selectedMatch: any = null;
    resultForm = {
        set1Home: 0, set1Away: 0,
        set2Home: 0, set2Away: 0,
        set3Home: 0, set3Away: 0
    };

    constructor(
        private route: ActivatedRoute,
        private leagueService: LeagueService,
        private playerService: PlayerService
    ) { }

    ngOnInit(): void {
        this.leagueId = this.route.snapshot.paramMap.get('id');
        if (this.leagueId) {
            this.loadData();
        }
    }

    loadData() {
        this.loading = true;
        if (!this.leagueId) return;

        this.leagueService.getLeague(this.leagueId).subscribe(league => {
            this.league = league;
            this.processFixtures(league.matches || []);

            this.leagueService.getStandings(this.leagueId!).subscribe(standings => {
                this.processStandings(standings);
                this.loading = false;
            });
        });
    }

    processStandings(standings: any[]) {
        // Group standings by group name (default 'General' if undefined)
        this.groupedStandings = standings.reduce((acc, team) => {
            const group = team.group || 'General';
            if (!acc[group]) acc[group] = [];
            acc[group].push(team);
            return acc;
        }, {});
    }

    processFixtures(matches: any[]) {
        // Sort matches
        matches.sort((a, b) => a.round - b.round);

        // Group by round
        this.groupedFixtures = matches.reduce((acc, match) => {
            const round = match.round;
            if (!acc[round]) acc[round] = [];
            acc[round].push(match);
            return acc;
        }, {});
    }

    openResultModal(match: any) {
        this.selectedMatch = match;
        // Reset form
        this.resultForm = {
            set1Home: 0, set1Away: 0,
            set2Home: 0, set2Away: 0,
            set3Home: 0, set3Away: 0
        };
        // Open modal logic (using DaisyUI modal via checkbox or showModal API)
        // We will use a boolean or native dialog. Let's use simple boolean for now + strict template if.
        // Or better, standard DaisyUI hidden checkbox method.
        const modalCheckbox = document.getElementById('match-result-modal') as HTMLInputElement;
        if (modalCheckbox) modalCheckbox.checked = true;
    }

    closeResultModal() {
        const modalCheckbox = document.getElementById('match-result-modal') as HTMLInputElement;
        if (modalCheckbox) modalCheckbox.checked = false;
        this.selectedMatch = null;
    }

    saveResult() {
        if (!this.selectedMatch || !this.leagueId) return;

        const sets = [];
        // Logic to determine sets and winner
        let team1Sets = 0;
        let team2Sets = 0;

        // Set 1
        sets.push({ team1Games: this.resultForm.set1Home, team2Games: this.resultForm.set1Away });
        if (this.resultForm.set1Home > this.resultForm.set1Away) team1Sets++; else if (this.resultForm.set1Away > this.resultForm.set1Home) team2Sets++;

        // Set 2
        sets.push({ team1Games: this.resultForm.set2Home, team2Games: this.resultForm.set2Away });
        if (this.resultForm.set2Home > this.resultForm.set2Away) team1Sets++; else if (this.resultForm.set2Away > this.resultForm.set2Home) team2Sets++;

        // Set 3 (Optional if tied)
        if (team1Sets === 1 && team2Sets === 1) {
            sets.push({ team1Games: this.resultForm.set3Home, team2Games: this.resultForm.set3Away });
            if (this.resultForm.set3Home > this.resultForm.set3Away) team1Sets++; else if (this.resultForm.set3Away > this.resultForm.set3Home) team2Sets++;
        }

        const winnerId = team1Sets > team2Sets ? this.selectedMatch.team1Id :
            team2Sets > team1Sets ? this.selectedMatch.team2Id : null;

        if (!winnerId) {
            alert('El partido no puede terminar en empate (sets).');
            return;
        }

        this.leagueService.updateMatchResult(this.selectedMatch.id, sets, winnerId).subscribe(() => {
            this.closeResultModal();
            this.loadData();
        });
    }

    // Add Team Logic
    openaddTeamModal() {
        this.playerService.findAll().subscribe(players => {
            this.players = players;
        });
        this.showAddTeamModal = true;
    }

    closeAddTeamModal() {
        this.showAddTeamModal = false;
        this.selectedPlayer1 = null;
        this.selectedPlayer2 = null;
    }

    addTeam() {
        if (!this.selectedPlayer1 || !this.selectedPlayer2 || !this.leagueId) return;
        this.leagueService.addTeam(this.leagueId, this.selectedPlayer1, this.selectedPlayer2).subscribe({
            next: () => {
                this.closeAddTeamModal();
                this.loadData();
            },
            error: (err) => console.error(err)
        });
    }
}
