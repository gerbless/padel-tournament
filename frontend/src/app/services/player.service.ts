import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Player {
    id: string;
    name: string;
    totalPoints: number;
    leaguePoints?: number;
    tournamentPoints?: number;
    matchesWon: number;
    gamesWon: number;
    tournamentsPlayed: number;
    category?: { id: string; name: string; };
    position?: 'reves' | 'drive' | 'mixto';
    clubs?: { id: string; name: string; }[];
    identification?: string;
    email?: string;
}

@Injectable({
    providedIn: 'root'
})
export class PlayerService {
    private apiUrl = `${environment.apiUrl}/players`;

    constructor(private http: HttpClient) { }

    findAll(clubId?: string): Observable<Player[]> {
        const params: any = {};
        if (clubId) params.clubId = clubId;
        return this.http.get<Player[]>(this.apiUrl, { params });
    }

    createPlayer(name: string, categoryId?: string, position?: string, clubIds?: string[], identification?: string, email?: string): Observable<Player> {
        const body: any = { name };
        if (categoryId) body.categoryId = categoryId;
        if (position) body.position = position;
        if (clubIds) body.clubIds = clubIds;
        if (identification) body.identification = identification;
        if (email) body.email = email;
        return this.http.post<Player>(this.apiUrl, body);
    }

    updatePlayer(id: string, data: any): Observable<Player> {
        // data can now include clubIds
        return this.http.patch<Player>(`${this.apiUrl}/${id}`, data);
    }

    deletePlayer(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    getRanking(categoryId?: string, clubId?: string): Observable<Player[]> {
        const params: any = {};
        if (categoryId) params.categoryId = categoryId;
        if (clubId) params.clubId = clubId;
        return this.http.get<Player[]>(`${this.apiUrl}/ranking`, { params });
    }

    getLeagueRanking(categoryId?: string, clubId?: string): Observable<Player[]> {
        const params: any = {};
        if (categoryId) params.categoryId = categoryId;
        if (clubId) params.clubId = clubId;
        return this.http.get<Player[]>(`${this.apiUrl}/ranking/league`, { params });
    }

    getTournamentRanking(categoryId?: string, clubId?: string): Observable<Player[]> {
        const params: any = {};
        if (categoryId) params.categoryId = categoryId;
        if (clubId) params.clubId = clubId;
        return this.http.get<Player[]>(`${this.apiUrl}/ranking/tournament`, { params });
    }

    getPairRanking(type: 'global' | 'league' | 'tournament', categoryId?: string, clubId?: string): Observable<{ p1: Player, p2: Player, points: number }[]> {
        const params: any = { type };
        if (categoryId) params.categoryId = categoryId;
        if (clubId) params.clubId = clubId;
        return this.http.get<{ p1: Player, p2: Player, points: number }[]>(`${this.apiUrl}/ranking/pairs`, { params });
    }

    getRecommendedMatches(clubId?: string): Observable<any[]> {
        const params: any = {};
        if (clubId) params.clubId = clubId;
        return this.http.get<any[]>(`${this.apiUrl}/recommendations`, { params });
    }

    getPartnerRecommendations(clubId?: string): Observable<any[]> {
        const params: any = {};
        if (clubId) params.clubId = clubId;
        return this.http.get<any[]>(`${this.apiUrl}/partner-recommendations`, { params });
    }
}
