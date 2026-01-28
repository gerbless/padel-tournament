import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Club, CreateClubDto, UpdateClubDto } from '../models/club.model';
import { Player } from './player.service';
import { environment } from '../../environments/environment';

@Injectable({
    providedIn: 'root'
})
export class ClubService {
    private apiUrl = `${environment.apiUrl}/clubs`;
    private selectedClubSubject = new BehaviorSubject<Club | null>(null);
    public selectedClub$ = this.selectedClubSubject.asObservable();

    constructor(private http: HttpClient) {
        this.loadSelectedClubFromStorage();
    }

    private loadSelectedClubFromStorage(): void {
        const storedClub = localStorage.getItem('selectedClub');
        if (storedClub) {
            try {
                const club = JSON.parse(storedClub);
                this.selectedClubSubject.next(club);
            } catch (e) {
                console.error('Error parsing stored club:', e);
                localStorage.removeItem('selectedClub');
            }
        }
    }

    getClubs(): Observable<Club[]> {
        return this.http.get<Club[]>(this.apiUrl);
    }

    getClub(id: string): Observable<Club> {
        return this.http.get<Club>(`${this.apiUrl}/${id}`);
    }

    createClub(createClubDto: CreateClubDto): Observable<Club> {
        return this.http.post<Club>(this.apiUrl, createClubDto);
    }

    updateClub(id: string, updateClubDto: UpdateClubDto): Observable<Club> {
        return this.http.patch<Club>(`${this.apiUrl}/${id}`, updateClubDto);
    }

    deleteClub(id: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${id}`);
    }

    getClubPlayers(clubId: string): Observable<Player[]> {
        return this.http.get<Player[]>(`${this.apiUrl}/${clubId}/players`);
    }

    addPlayerToClub(clubId: string, playerId: string): Observable<void> {
        return this.http.post<void>(`${this.apiUrl}/${clubId}/players/${playerId}`, {});
    }

    removePlayerFromClub(clubId: string, playerId: string): Observable<void> {
        return this.http.delete<void>(`${this.apiUrl}/${clubId}/players/${playerId}`);
    }

    getTopPlayersGlobal(): Observable<Player[]> {
        return this.http.get<Player[]>(`${environment.apiUrl}/players/top-global`);
    }

    selectClub(club: Club): void {
        this.selectedClubSubject.next(club);
        localStorage.setItem('selectedClub', JSON.stringify(club));
    }

    getSelectedClub(): Club | null {
        return this.selectedClubSubject.value;
    }

    clearSelectedClub(): void {
        this.selectedClubSubject.next(null);
        localStorage.removeItem('selectedClub');
    }
}
