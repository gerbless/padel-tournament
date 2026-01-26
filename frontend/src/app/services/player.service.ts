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
}

@Injectable({
    providedIn: 'root'
})
export class PlayerService {
    private apiUrl = `${environment.apiUrl}/players`;

    constructor(private http: HttpClient) { }

    findAll(): Observable<Player[]> {
        return this.http.get<Player[]>(this.apiUrl);
    }

    createPlayer(name: string, categoryId?: string, position?: string): Observable<Player> {
        const body: any = { name };
        if (categoryId) body.categoryId = categoryId;
        if (position) body.position = position;
        return this.http.post<Player>(this.apiUrl, body);
    }

    updatePlayer(id: string, data: any): Observable<Player> {
        return this.http.patch<Player>(`${this.apiUrl}/${id}`, data);
    }

    deletePlayer(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    getRanking(categoryId?: string): Observable<Player[]> {
        const params: any = {};
        if (categoryId) params.categoryId = categoryId;
        return this.http.get<Player[]>(`${this.apiUrl}/ranking`, { params });
    }

    getLeagueRanking(categoryId?: string): Observable<Player[]> {
        const params: any = {};
        if (categoryId) params.categoryId = categoryId;
        return this.http.get<Player[]>(`${this.apiUrl}/ranking/league`, { params });
    }

    getTournamentRanking(categoryId?: string): Observable<Player[]> {
        const params: any = {};
        if (categoryId) params.categoryId = categoryId;
        return this.http.get<Player[]>(`${this.apiUrl}/ranking/tournament`, { params });
    }

    getPairRanking(type: 'global' | 'league' | 'tournament', categoryId?: string): Observable<{ p1: Player, p2: Player, points: number }[]> {
        const params: any = { type };
        if (categoryId) params.categoryId = categoryId;
        return this.http.get<{ p1: Player, p2: Player, points: number }[]>(`${this.apiUrl}/ranking/pairs`, { params });
    }

    getRecommendedMatches(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/recommendations`);
    }

    getPartnerRecommendations(): Observable<any[]> {
        return this.http.get<any[]>(`${this.apiUrl}/partner-recommendations`);
    }
}
