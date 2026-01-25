import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { Match, SetResult } from './tournament.service';

export interface UpdateMatchScoreRequest {
    sets: SetResult[];
}

@Injectable({
    providedIn: 'root'
})
export class MatchService {
    private apiUrl = `${environment.apiUrl}/matches`;

    constructor(private http: HttpClient) { }

    getMatch(id: string): Observable<Match> {
        return this.http.get<Match>(`${this.apiUrl}/${id}`);
    }

    updateMatchScore(id: string, data: UpdateMatchScoreRequest): Observable<Match> {
        return this.http.patch<Match>(`${this.apiUrl}/${id}/score`, data);
    }
}
