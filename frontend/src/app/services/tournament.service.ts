import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export type TournamentType = 'cuadrangular' | 'hexagonal' | 'octagonal' | 'decagonal' | 'dodecagonal';
export type DurationMode = 'fixed' | 'free';
export type MatchPhase = 'group' | 'elimination';

export interface Tournament {
    id: string;
    name: string;
    clubId?: string;
    type: TournamentType;
    status: 'draft' | 'in_progress' | 'completed';
    courts: number;
    durationMode: DurationMode;
    durationMinutes?: number;
    matchesPerTeam?: number;
    totalGroups?: number;
    teams: Team[];
    matches: Match[];
    createdAt: string;
    updatedAt: string;
    config?: {
        strictScoring?: boolean;
        allowTies?: boolean;
    };
}

export interface Team {
    id: string;
    player1: { id: string; name: string };
    player2: { id: string; name: string };
    tournamentId: string;
    groupNumber?: number;
}

export interface Match {
    id: string;
    tournamentId: string;
    team1Id: string;
    team2Id: string;
    team1?: Team;
    team2?: Team;
    status: 'pending' | 'in_progress' | 'completed';
    sets?: SetResult[];
    winnerId?: string;
    winner?: Team;
    groupNumber?: number;
    courtNumber?: number;
    round?: number;
    phase?: MatchPhase;
}

export interface SetResult {
    team1Games: number;
    team2Games: number;
    tiebreak?: {
        team1Points: number;
        team2Points: number;
    };
}

export interface Standing {
    teamId: string;
    player1Name: string;
    player2Name: string;
    matchesPlayed: number;
    matchesWon: number;
    matchesDrawn: number;
    matchesLost: number;
    setsWon: number;
    setsLost: number;
    setDifference: number;
    gamesWon: number;
    gamesLost: number;
    gameDifference: number;
    position: number;
    points: number;
    groupNumber?: number;
}

export interface CreateTournamentRequest {
    name: string;
    courts: number;
    durationMode: DurationMode;
    durationMinutes?: number;
    matchesPerTeam?: number;
    totalGroups?: number;
    teams: { player1Name: string; player2Name: string; groupNumber: number }[];
    clubId?: string;
    config?: any;
}

export interface MonthlyPlayerStat {
    id: string;
    name: string;
    matchesWon: number;
    matchesPlayed: number;
    tournamentsPlayed: number;
}

export interface MonthlyPairStat {
    player1Name: string;
    player2Name: string;
    matchesWon: number;
    matchesPlayed: number;
    tournamentsPlayed: number;
}

export interface MonthlyStats {
    month: number;
    year: number;
    totalTournaments: number;
    totalMatches: number;
    topPlayers: MonthlyPlayerStat[];
    topPairs: MonthlyPairStat[];
}

@Injectable({
    providedIn: 'root'
})
export class TournamentService {
    private apiUrl = `${environment.apiUrl}/tournaments`;

    constructor(private http: HttpClient) { }

    getTournaments(clubId?: string, month?: number, year?: number): Observable<Tournament[]> {
        const params: any = {};
        if (clubId) params.clubId = clubId;
        if (month) params.month = month.toString();
        if (year) params.year = year.toString();
        return this.http.get<any>(this.apiUrl, { params }).pipe(
            map(res => Array.isArray(res) ? res : res.data)
        );
    }

    getTournament(id: string): Observable<Tournament> {
        return this.http.get<Tournament>(`${this.apiUrl}/${id}`);
    }

    createTournament(data: CreateTournamentRequest): Observable<Tournament> {
        return this.http.post<Tournament>(this.apiUrl, data);
    }

    getStandings(id: string, groupNumber?: number, phase?: string): Observable<Standing[]> {
        const params: any = {};
        if (groupNumber) params.group = groupNumber.toString();
        if (phase) params.phase = phase;
        return this.http.get<Standing[]>(`${this.apiUrl}/${id}/standings`, { params });
    }

    generateElimination(id: string): Observable<Match[]> {
        return this.http.post<Match[]>(`${this.apiUrl}/${id}/generate-elimination`, {});
    }

    deleteTournament(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    closeTournament(id: string): Observable<Tournament> {
        return this.http.post<Tournament>(`${this.apiUrl}/${id}/close`, {});
    }

    getMonthlyStats(month: number, year: number, clubId?: string): Observable<MonthlyStats> {
        const params: any = { month: month.toString(), year: year.toString() };
        if (clubId) params.clubId = clubId;
        return this.http.get<MonthlyStats>(`${this.apiUrl}/stats/monthly`, { params });
    }
}
