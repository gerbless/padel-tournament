import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface League {
    id: string;
    name: string;
    type: 'round_robin' | 'groups_playoff';
    status: 'draft' | 'in_progress' | 'completed';
    startDate?: Date;
    endDate?: Date;
    config: any;
    teams?: any[];
    matches?: any[];
}

@Injectable({
    providedIn: 'root'
})
export class LeagueService {
    private apiUrl = `${environment.apiUrl}/leagues`;

    constructor(private http: HttpClient) { }

    getLeagues(): Observable<League[]> {
        return this.http.get<League[]>(this.apiUrl);
    }

    getLeague(id: string): Observable<League> {
        return this.http.get<League>(`${this.apiUrl}/${id}`);
    }

    createLeague(league: Partial<League>): Observable<League> {
        return this.http.post<League>(this.apiUrl, league);
    }

    updateLeague(id: string, league: Partial<League>): Observable<League> {
        return this.http.patch<League>(`${this.apiUrl}/${id}`, league);
    }

    deleteLeague(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    addTeam(leagueId: string, player1Id: string, player2Id: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/${leagueId}/teams`, { player1Id, player2Id });
    }

    generateFixtures(leagueId: string): Observable<any> {
        return this.http.post(`${this.apiUrl}/${leagueId}/fixtures`, {});
    }

    generateGroups(leagueId: string, numberOfGroups: number): Observable<any> {
        return this.http.post(`${this.apiUrl}/${leagueId}/groups`, { numberOfGroups });
    }

    getStandings(leagueId: string): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/${leagueId}/standings`);
    }

    updateMatchResult(matchId: string, sets: any[], winnerId: string): Observable<any> {
        return this.http.patch<any>(`${this.apiUrl}/matches/${matchId}/result`, { sets, winnerId });
    }
}
