import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Tournament {
    id: string;
    name: string;
    type: 'cuadrangular' | 'hexagonal';
    status: 'draft' | 'in_progress' | 'completed';
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
    player1Name: string; // Backend might still return this flattened in getStandings custom query? Let's check backend service.
    player2Name: string; // Checked backend TournamentsService.getStandings: it manually constructs the object.
    matchesWon: number;
    matchesLost: number;
    setsWon: number;
    setsLost: number;
    setDifference: number;
    gamesWon: number;
    gamesLost: number;
    gameDifference: number;
    position: number;
}


export interface CreateTournamentRequest {
    name: string;
    type: 'cuadrangular' | 'hexagonal';
    teams: { player1Name: string; player2Name: string }[];
    clubId?: string;
}

@Injectable({
    providedIn: 'root'
})
export class TournamentService {
    private apiUrl = `${environment.apiUrl}/tournaments`;

    constructor(private http: HttpClient) { }

    getTournaments(clubId?: string): Observable<Tournament[]> {
        const params: any = {};
        if (clubId) params.clubId = clubId;
        return this.http.get<Tournament[]>(this.apiUrl, { params });
    }

    getTournament(id: string): Observable<Tournament> {
        return this.http.get<Tournament>(`${this.apiUrl}/${id}`);
    }

    createTournament(data: CreateTournamentRequest): Observable<Tournament> {
        return this.http.post<Tournament>(this.apiUrl, data);
    }

    getStandings(id: string): Observable<Standing[]> {
        return this.http.get<Standing[]>(`${this.apiUrl}/${id}/standings`);
    }

    deleteTournament(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    closeTournament(id: string): Observable<Tournament> {
        return this.http.post<Tournament>(`${this.apiUrl}/${id}/close`, {});
    }
}
