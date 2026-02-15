import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

export interface PersonalMatch {
    id?: string;
    date: string; // ISO string
    partnerId: string;
    rival1Id: string;
    rival2Id: string;
    clubId?: string;
    sets: { set: number, myScore: number, rivalScore: number, tieBreak?: boolean }[];
    status?: 'draft' | 'in_progress' | 'completed';
    result?: 'win' | 'loss';

    // Expanded properties from backend
    partner?: any;
    rival1?: any;
    rival2?: any;
    club?: any;
}

export interface PersonalStats {
    totalMatches: number;
    wins: number;
    losses: number;
    winRate: number;
    bestPartner: { name: string, wins: number, played: number, rate: number } | null;
    toughestRival: { name: string, losses: number, played: number, lossRate: number } | null;
    evolution: { date: string, points: number }[];
    partnerStats: any[];
    rivalStats: any[];
}

@Injectable({
    providedIn: 'root'
})
export class PersonalTrackerService {
    private apiUrl = environment.apiUrl + '/personal-tracker';

    constructor(private http: HttpClient) { }

    createMatch(match: Partial<PersonalMatch>): Observable<PersonalMatch> {
        return this.http.post<PersonalMatch>(this.apiUrl, match);
    }

    getMatch(id: string): Observable<PersonalMatch> {
        return this.http.get<PersonalMatch>(`${this.apiUrl}/${id}`);
    }

    updateMatch(id: string, updates: Partial<PersonalMatch>): Observable<PersonalMatch> {
        return this.http.patch<PersonalMatch>(`${this.apiUrl}/${id}`, updates);
    }

    deleteMatch(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    getHistory(): Observable<PersonalMatch[]> {
        return this.http.get<PersonalMatch[]>(`${this.apiUrl}/history`);
    }

    getInProgress(): Observable<PersonalMatch[]> {
        return this.http.get<PersonalMatch[]>(`${this.apiUrl}/in-progress`);
    }

    getStats(): Observable<PersonalStats> {
        return this.http.get<PersonalStats>(`${this.apiUrl}/stats`);
    }
}
