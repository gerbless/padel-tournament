import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { LeagueService, League } from '../../services/league.service';

@Component({
    selector: 'app-league-list',
    standalone: true,
    imports: [CommonModule, RouterModule],
    templateUrl: './league-list.component.html',
    styleUrls: ['./league-list.component.css']
})
export class LeagueListComponent implements OnInit {
    leagues: League[] = [];
    loading = true;

    constructor(private leagueService: LeagueService) { }

    ngOnInit(): void {
        this.loadLeagues();
    }

    loadLeagues(): void {
        this.loading = true;
        this.leagueService.getLeagues().subscribe({
            next: (data) => {
                this.leagues = data;
                this.loading = false;
            },
            error: (err) => {
                console.error('Error loading leagues', err);
                this.loading = false;
            }
        });
    }

    deleteLeague(id: string): void {
        if (confirm('Are you sure you want to delete this league? This action cannot be undone.')) {
            this.leagueService.deleteLeague(id).subscribe(() => {
                this.loadLeagues();
            });
        }
    }

    getEndDate(league: League): Date | undefined {
        // If endDate is stored as string, parse it, or return if Date
        return league.endDate ? new Date(league.endDate) : undefined;
    }
}
