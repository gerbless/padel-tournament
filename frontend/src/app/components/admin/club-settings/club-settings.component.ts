import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ClubService } from '../../../services/club.service';
import { AuthService } from '../../../services/auth.service';
import { PermissionsService, SIDEBAR_ITEMS, NavItem } from '../../../services/permissions.service';
import { Club, EnabledModules, DEFAULT_ENABLED_MODULES } from '../../../models/club.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ConfirmService } from '../../../services/confirm.service';

interface ClubUser {
    id: string;
    userId: string;
    clubId: string;
    role: string;
    user: {
        id: string;
        email: string;
        role: string;
        player?: { id: string; name: string } | null;
    };
}

@Component({
    selector: 'app-club-settings',
    standalone: true,
    imports: [CommonModule, FormsModule, RouterModule],
    changeDetection: ChangeDetectionStrategy.OnPush,
    templateUrl: './club-settings.component.html',
    styleUrls: ['./club-settings.component.css'],
})
export class ClubSettingsComponent implements OnInit, OnDestroy {
    club: Club | null = null;
    modules: EnabledModules = { ...DEFAULT_ENABLED_MODULES };
    moduleItems = SIDEBAR_ITEMS;
    clubUsers: ClubUser[] = [];
    allUsers: any[] = [];

    saving = false;
    loadingUsers = false;
    activeTab: 'modules' | 'users' = 'modules';
    freePlayPointsPerWin = 3;

    // Role assignment form
    selectedUserId = '';
    selectedRole = 'viewer';

    // User creation form
    showCreateUser = false;
    creatingUser = false;
    newUserEmail = '';
    newUserPassword = '';
    newUserRole = 'viewer';
    createUserError = '';
    createUserSuccess = '';

    // Player linking
    allPlayers: any[] = [];
    linkingPlayerId: string | null = null;
    selectedPlayerId = '';

    private subs: Subscription[] = [];
    private cdr = inject(ChangeDetectorRef);

    constructor(
        private clubService: ClubService,
        private authService: AuthService,
        private permissionsService: PermissionsService,
        private http: HttpClient,
        private router: Router,
        private confirmService: ConfirmService,
    ) { }

    ngOnInit() {
        this.subs.push(
            this.clubService.selectedClub$.subscribe(club => {
                this.club = club;
                if (club) {
                    this.modules = { ...DEFAULT_ENABLED_MODULES, ...(club.enabledModules || {}) };
                    this.freePlayPointsPerWin = club.freePlayPointsPerWin || 3;
                    this.loadClubUsers();
                    this.loadAllUsers();
                    this.loadPlayers();
                }
                this.cdr.markForCheck();
            })
        );
    }

    ngOnDestroy() {
        this.subs.forEach(s => s.unsubscribe());
    }

    get canAccess(): boolean {
        return this.permissionsService.canAdminCurrentClub();
    }

    getModuleLabel(key: string): string {
        const item = this.moduleItems.find(i => i.moduleKey === key);
        return item ? item.label : key;
    }

    getModuleIcon(key: string): string {
        const item = this.moduleItems.find(i => i.moduleKey === key);
        return item ? item.icon : '📦';
    }

    getModuleVisibility(key: string): string {
        const item = this.moduleItems.find(i => i.moduleKey === key);
        if (!item) return '';
        if (item.publicVisible) return 'Visible al público';
        switch (item.minRole) {
            case 'viewer': return 'Visible para miembros';
            case 'editor': return 'Solo editores y admin';
            case 'admin': return 'Solo administradores';
            default: return '';
        }
    }

    get moduleKeys(): (keyof EnabledModules)[] {
        return Object.keys(this.modules) as (keyof EnabledModules)[];
    }

    isModuleEnabled(key: keyof EnabledModules): boolean {
        return this.modules[key];
    }

    toggleModule(key: keyof EnabledModules): void {
        this.modules[key] = !this.modules[key];
    }

    async saveModules() {
        if (!this.club || this.saving) return;
        this.saving = true;
        this.cdr.markForCheck();

        try {
            const updated = await this.http.patch<Club>(
                `${environment.apiUrl}/clubs/${this.club.id}`,
                { enabledModules: this.modules, freePlayPointsPerWin: this.freePlayPointsPerWin }
            ).toPromise();

            if (updated) {
                // Update the stored club in ClubService
                const updatedClub = { ...this.club, enabledModules: this.modules, freePlayPointsPerWin: this.freePlayPointsPerWin };
                this.clubService.selectClub(updatedClub);
            }
        } catch (e) {
            console.error('Error saving modules', e);
        } finally {
            this.saving = false;
            this.cdr.markForCheck();
        }
    }

    // ─── User Management ──────────────────────────────

    loadClubUsers() {
        if (!this.club) return;
        this.loadingUsers = true;
        this.cdr.markForCheck();

        this.http.get<ClubUser[]>(
            `${environment.apiUrl}/users/club/${this.club.id}/members`
        ).subscribe({
            next: (users) => {
                this.clubUsers = users;
                this.loadingUsers = false;
                this.cdr.markForCheck();
            },
            error: () => {
                this.loadingUsers = false;
                this.cdr.markForCheck();
            }
        });
    }

    loadAllUsers() {
        this.http.get<any[]>(
            `${environment.apiUrl}/users`
        ).subscribe({
            next: (users) => {
                this.allUsers = users;
                this.cdr.markForCheck();
            }
        });
    }

    get availableUsers(): any[] {
        const assignedIds = new Set(this.clubUsers.map(u => u.userId));
        return this.allUsers.filter(u => !assignedIds.has(u.id));
    }

    assignRole() {
        if (!this.club || !this.selectedUserId || !this.selectedRole) return;
        this.http.post(
            `${environment.apiUrl}/users/${this.selectedUserId}/club-roles`,
            { clubId: this.club.id, role: this.selectedRole }
        ).subscribe({
            next: () => {
                this.selectedUserId = '';
                this.loadClubUsers();
            },
            error: (err) => console.error('Error assigning role', err)
        });
    }

    changeRole(ucr: ClubUser, newRole: string) {
        this.http.post(
            `${environment.apiUrl}/users/${ucr.userId}/club-roles`,
            { clubId: ucr.clubId, role: newRole }
        ).subscribe({
            next: () => this.loadClubUsers(),
            error: (err) => console.error('Error changing role', err)
        });
    }

    async removeUserRole(ucr: ClubUser) {
        const ok = await this.confirmService.confirm({
            title: 'Eliminar Acceso',
            message: `¿Eliminar el acceso de <strong>${ucr.user.email}</strong> a este club?`,
            confirmText: 'Eliminar'
        });
        if (!ok) return;
        this.http.delete(
            `${environment.apiUrl}/users/${ucr.userId}/club-roles/${ucr.clubId}`
        ).subscribe({
            next: () => this.loadClubUsers(),
            error: (err) => console.error('Error removing role', err)
        });
    }

    getRoleBadgeClass(role: string): string {
        return `role-badge role-${role}`;
    }

    getRoleLabel(role: string): string {
        switch (role) {
            case 'admin': return '🔑 Administrador';
            case 'editor': return '✏️ Editor';
            case 'viewer': return '👁️ Visualizador';
            default: return role;
        }
    }

    // ─── User Creation ────────────────────────────────

    toggleCreateUser() {
        this.showCreateUser = !this.showCreateUser;
        this.createUserError = '';
        this.createUserSuccess = '';
        this.newUserEmail = '';
        this.newUserPassword = '';
        this.newUserRole = 'viewer';
    }

    createUser() {
        if (!this.club || !this.newUserEmail || !this.newUserPassword) return;
        this.creatingUser = true;
        this.createUserError = '';
        this.createUserSuccess = '';
        this.cdr.markForCheck();

        this.http.post<any>(
            `${environment.apiUrl}/users/register`,
            { email: this.newUserEmail, password: this.newUserPassword }
        ).subscribe({
            next: (newUser) => {
                // Auto-assign the user to the current club
                this.http.post(
                    `${environment.apiUrl}/users/${newUser.id}/club-roles`,
                    { clubId: this.club!.id, role: this.newUserRole }
                ).subscribe({
                    next: () => {
                        this.createUserSuccess = `Usuario ${this.newUserEmail} creado y asignado al club como ${this.getRoleLabel(this.newUserRole)}`;
                        this.newUserEmail = '';
                        this.newUserPassword = '';
                        this.creatingUser = false;
                        this.loadClubUsers();
                        this.loadAllUsers();
                        this.cdr.markForCheck();
                    },
                    error: () => {
                        this.createUserSuccess = `Usuario creado pero no se pudo asignar al club automáticamente.`;
                        this.creatingUser = false;
                        this.loadAllUsers();
                        this.cdr.markForCheck();
                    }
                });
            },
            error: (err) => {
                this.createUserError = err.error?.message || 'Error al crear el usuario';
                this.creatingUser = false;
                this.cdr.markForCheck();
            }
        });
    }

    generatePassword(): string {
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
        let pass = '';
        for (let i = 0; i < 10; i++) {
            pass += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        this.newUserPassword = pass;
        return pass;
    }

    // ─── Player Linking ───────────────────────────────

    loadPlayers() {
        if (!this.club) return;
        this.http.get<any[]>(
            `${environment.apiUrl}/clubs/${this.club.id}/players`
        ).subscribe({
            next: (players) => {
                this.allPlayers = players;
                this.cdr.markForCheck();
            }
        });
    }

    startLinkPlayer(userId: string) {
        this.linkingPlayerId = this.linkingPlayerId === userId ? null : userId;
        this.selectedPlayerId = '';
        this.cdr.markForCheck();
    }

    linkPlayer(userId: string) {
        if (!this.selectedPlayerId) return;
        this.http.post(
            `${environment.apiUrl}/users/${userId}/link-player`,
            { playerId: this.selectedPlayerId }
        ).subscribe({
            next: () => {
                this.linkingPlayerId = null;
                this.selectedPlayerId = '';
                this.loadClubUsers();
                this.loadAllUsers();
                this.cdr.markForCheck();
            },
            error: (err) => console.error('Error linking player', err)
        });
    }

    getUnlinkedPlayers(): any[] {
        const linkedPlayerIds = new Set(
            [...this.clubUsers, ...this.allUsers]
                .filter(u => (u.user?.player?.id || u.player?.id || u.playerId))
                .map(u => u.user?.player?.id || u.player?.id || u.playerId)
        );
        return this.allPlayers.filter(p => !linkedPlayerIds.has(p.id));
    }
}
