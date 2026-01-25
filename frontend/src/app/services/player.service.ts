import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface Player {
    id: string;
    name: string;
    totalPoints: number;
    matchesWon: number;
    gamesWon: number;
    tournamentsPlayed: number;
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

    createPlayer(name: string): Observable<Player> {
        return this.http.post<Player>(this.apiUrl, { name });
    }

    deletePlayer(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    getRanking(): Observable<Player[]> {
        return this.http.get<Player[]>(`${this.apiUrl}/ranking`);
    }
}
