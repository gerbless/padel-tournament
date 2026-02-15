
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ClubRole {
    clubId: string;
    clubName: string;
    role: string; // 'admin' | 'editor' | 'viewer'
}

export interface CurrentUser {
    id?: string;
    username: string;
    role: string; // global role: 'super_admin' | 'user'
    playerId?: string;
    clubRoles: ClubRole[];
}

@Injectable({ providedIn: 'root' })
export class AuthService {
    private apiUrl = environment.apiUrl + '/auth';
    private currentUserSubject = new BehaviorSubject<CurrentUser | null>(null);
    public currentUser$ = this.currentUserSubject.asObservable();

    constructor(private http: HttpClient) {
        this.loadUser();
    }

    private loadUser() {
        const storedUser = localStorage.getItem('currentUser');
        if (storedUser) {
            try {
                this.currentUserSubject.next(JSON.parse(storedUser));
            } catch (e) {
                console.error('Error parsing stored user', e);
                this.logout();
            }
        }
    }

    login(username: string, password: string): Observable<any> {
        return this.http.post<any>(`${this.apiUrl}/login`, { username, password }).pipe(
            tap(response => {
                if (response.access_token) {
                    localStorage.setItem('token', response.access_token);
                    const user: CurrentUser = {
                        id: response.user.id,
                        username: response.user.username,
                        role: response.user.role,
                        playerId: response.user.playerId,
                        clubRoles: response.user.clubRoles || [],
                    };
                    localStorage.setItem('currentUser', JSON.stringify(user));
                    this.currentUserSubject.next(user);
                }
            })
        );
    }

    logout() {
        localStorage.removeItem('token');
        localStorage.removeItem('currentUser');
        this.currentUserSubject.next(null);
    }

    getToken(): string | null {
        return localStorage.getItem('token');
    }

    isAuthenticated(): boolean {
        return !!this.getToken();
    }

    getCurrentUser(): CurrentUser | null {
        return this.currentUserSubject.value;
    }

    /** Check if current user is super_admin */
    isSuperAdmin(): boolean {
        return this.currentUserSubject.value?.role === 'super_admin';
    }

    /** Get the user's role for a specific club */
    getClubRole(clubId: string): string | null {
        const user = this.currentUserSubject.value;
        if (!user) return null;
        if (user.role === 'super_admin') return 'admin'; // super_admin has admin on all clubs
        const cr = user.clubRoles?.find(r => r.clubId === clubId);
        return cr?.role || null;
    }

    /** Check if user has at least the specified role for a club */
    hasClubRole(clubId: string, requiredRole: string): boolean {
        const role = this.getClubRole(clubId);
        if (!role) return false;
        const hierarchy: Record<string, number> = { admin: 3, editor: 2, viewer: 1 };
        return (hierarchy[role] || 0) >= (hierarchy[requiredRole] || 0);
    }

    /** Get list of club IDs where user has any role */
    getUserClubIds(): string[] {
        const user = this.currentUserSubject.value;
        if (!user) return [];
        return (user.clubRoles || []).map(r => r.clubId);
    }

    /** Refresh user profile from backend (e.g. after role changes) */
    refreshProfile(): Observable<any> {
        return this.http.get<any>(`${environment.apiUrl}/users/me`).pipe(
            tap(userData => {
                if (userData) {
                    const user: CurrentUser = {
                        id: userData.id,
                        username: userData.email,
                        role: userData.role,
                        playerId: userData.playerId,
                        clubRoles: (userData.clubRoles || []).map((ucr: any) => ({
                            clubId: ucr.clubId,
                            clubName: ucr.club?.name || '',
                            role: ucr.role,
                        })),
                    };
                    localStorage.setItem('currentUser', JSON.stringify(user));
                    this.currentUserSubject.next(user);
                }
            })
        );
    }
}
