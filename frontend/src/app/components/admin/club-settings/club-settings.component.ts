import { Component, OnInit, OnDestroy, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { Subscription } from 'rxjs';
import { ClubService } from '../../../services/club.service';
import { AuthService } from '../../../services/auth.service';
import { PermissionsService, SIDEBAR_ITEMS, NavItem } from '../../../services/permissions.service';
import { Club, EnabledModules, DEFAULT_ENABLED_MODULES, ClubSmtpCredentials, ClubTwilioCredentials, ClubMercadoPagoCredentials, ClubTransferInfo } from '../../../models/club.model';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../environments/environment';
import { ConfirmService } from '../../../services/confirm.service';
import { PaymentService } from '../../../services/payment.service';

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
    activeTab: 'modules' | 'users' | 'features' | 'credentials' | 'clubs' = 'modules';
    freePlayPointsPerWin = 3;

    // Feature flags
    enablePhoneVerification = false;
    enablePaymentLinkSending = false;
    enablePayments = true;
    savingFeatures = false;

    // Credentials (super_admin only)
    smtpCreds: ClubSmtpCredentials = {};
    twilioCreds: ClubTwilioCredentials = {};
    mpCreds: ClubMercadoPagoCredentials = {};
    // Snapshots of masked values returned by the API — used to detect changes
    private _maskedSmtp: ClubSmtpCredentials = {};
    private _maskedTwilio: ClubTwilioCredentials = {};
    private _maskedMp: ClubMercadoPagoCredentials = {};
    loadingCredentials = false;
    savingSmtp = false;
    savingTwilio = false;
    savingMp = false;
    credentialsLoaded = false;

    // Transfer info (super_admin, stored directly on club)
    transferInfo: ClubTransferInfo = {};
    savingTransfer = false;

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

    // Club management (super_admin)
    allClubs: Club[] = [];
    loadingClubs = false;
    newClubName = '';
    newClubDescription = '';
    creatingClub = false;
    createClubError = '';
    createClubSuccess = '';

    private subs: Subscription[] = [];
    private cdr = inject(ChangeDetectorRef);

    constructor(
        private clubService: ClubService,
        private authService: AuthService,
        private permissionsService: PermissionsService,
        private http: HttpClient,
        private router: Router,
        private confirmService: ConfirmService,
        private paymentService: PaymentService,
    ) { }

    ngOnInit() {
        this.subs.push(
            this.clubService.selectedClub$.subscribe(club => {
                this.club = club;
                if (club) {
                    this.modules = { ...DEFAULT_ENABLED_MODULES, ...(club.enabledModules || {}) };
                    this.freePlayPointsPerWin = club.freePlayPointsPerWin || 3;
                    this.enablePhoneVerification = club.enablePhoneVerification ?? false;
                    this.enablePaymentLinkSending = club.enablePaymentLinkSending ?? false;
                    this.enablePayments = club.enablePayments ?? true;
                    this.transferInfo = { ...(club.transferInfo ?? {}) };
                    this.loadClubUsers();
                    this.loadAllUsers();
                    this.loadPlayers();
                    if (this.authService.isSuperAdmin()) {
                        this.loadCredentials(club.id);
                        this.loadAllClubs();
                    }
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

    // ─── Feature Flags ────────────────────────────────

    async saveFeatures() {
        if (!this.club || this.savingFeatures) return;
        this.savingFeatures = true;
        this.cdr.markForCheck();

        try {
            const updated = await this.http.patch<Club>(
                `${environment.apiUrl}/clubs/${this.club.id}`,
                {
                    enablePhoneVerification: this.enablePhoneVerification,
                    enablePaymentLinkSending: this.enablePaymentLinkSending,
                    enablePayments: this.enablePayments,
                }
            ).toPromise();

            if (updated) {
                const updatedClub = {
                    ...this.club,
                    enablePhoneVerification: this.enablePhoneVerification,
                    enablePaymentLinkSending: this.enablePaymentLinkSending,
                    enablePayments: this.enablePayments,
                };
                this.clubService.selectClub(updatedClub);
                // Invalidate cached payment config so all views pick up the new enablePayments value
                this.paymentService.clearCache(this.club.id);
            }
        } catch (e) {
            console.error('Error saving features', e);
        } finally {
            this.savingFeatures = false;
            this.cdr.markForCheck();
        }
    }

    // ─── Credentials (super_admin only) ──────────────

    get isSuperAdmin(): boolean {
        return this.authService.isSuperAdmin();
    }

    loadCredentials(clubId: string) {
        this.loadingCredentials = true;
        this.cdr.markForCheck();
        this.clubService.getCredentials(clubId).subscribe({
            next: (creds) => {
                // Store masked values — the form shows them so the user can see what’s saved.
                // Snapshots are kept separately to detect when the user actually changes a field.
                this.smtpCreds   = { ...(creds.smtp ?? {}) };
                this.twilioCreds = { ...(creds.twilio ?? {}) };
                this.mpCreds     = { ...(creds.mercadopago ?? {}) };
                this._maskedSmtp   = { ...(creds.smtp ?? {}) };
                this._maskedTwilio = { ...(creds.twilio ?? {}) };
                this._maskedMp     = { ...(creds.mercadopago ?? {}) };
                this.credentialsLoaded = true;
                this.loadingCredentials = false;
                this.cdr.markForCheck();
            },
            error: () => {
                this.loadingCredentials = false;
                this.cdr.markForCheck();
            },
        });
    }

    /** Returns true if the user changed at least one SMTP field from the masked snapshot. */
    hasSmtpChanges(): boolean {
        return this.hasObjectChanges(this.smtpCreds, this._maskedSmtp);
    }

    /** Returns true if the user changed at least one Twilio field from the masked snapshot. */
    hasTwilioChanges(): boolean {
        return this.hasObjectChanges(this.twilioCreds, this._maskedTwilio);
    }

    /** Returns true if the user changed at least one Mercado Pago field from the masked snapshot. */
    hasMpChanges(): boolean {
        return this.hasObjectChanges(this.mpCreds, this._maskedMp);
    }

    private hasObjectChanges(current: Record<string, any>, original: Record<string, any>): boolean {
        const keys = new Set([...Object.keys(current), ...Object.keys(original)]);
        for (const k of keys) {
            const val = current[k];
            // A field is “changed” if it has a real value AND it differs from the snapshot.
            if (val !== undefined && val !== '' && val !== original[k]) return true;
        }
        return false;
    }

    async saveSmtp() {
        if (!this.club || this.savingSmtp || !this.hasSmtpChanges()) return;
        this.savingSmtp = true;
        this.cdr.markForCheck();
        try {
            await this.clubService.updateCredentials(this.club.id, { smtp: this.smtpCreds }).toPromise();
            // Refresh snapshot so the button disables again until the next edit
            this._maskedSmtp = { ...this.smtpCreds };
        } catch (e) { console.error('Error saving SMTP', e); }
        finally { this.savingSmtp = false; this.cdr.markForCheck(); }
    }

    async saveTwilio() {
        if (!this.club || this.savingTwilio || !this.hasTwilioChanges()) return;
        this.savingTwilio = true;
        this.cdr.markForCheck();
        try {
            await this.clubService.updateCredentials(this.club.id, { twilio: this.twilioCreds }).toPromise();
            this._maskedTwilio = { ...this.twilioCreds };
        } catch (e) { console.error('Error saving Twilio', e); }
        finally { this.savingTwilio = false; this.cdr.markForCheck(); }
    }

    async saveMp() {
        if (!this.club || this.savingMp || !this.hasMpChanges()) return;
        this.savingMp = true;
        this.cdr.markForCheck();
        try {
            await this.clubService.updateCredentials(this.club.id, { mercadopago: this.mpCreds }).toPromise();
            this._maskedMp = { ...this.mpCreds };
        } catch (e) { console.error('Error saving Mercado Pago', e); }
        finally { this.savingMp = false; this.cdr.markForCheck(); }
    }

    async saveTransferInfo() {
        if (!this.club || this.savingTransfer) return;
        this.savingTransfer = true;
        this.cdr.markForCheck();
        try {
            await this.http.patch<Club>(
                `${environment.apiUrl}/clubs/${this.club.id}`,
                { transferInfo: this.transferInfo }
            ).toPromise();
            this.clubService.selectClub({ ...this.club, transferInfo: { ...this.transferInfo } });
        } catch (e) { console.error('Error saving transfer info', e); }
        finally { this.savingTransfer = false; this.cdr.markForCheck(); }
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

    // ─── Club Management (super_admin) ────────────────

    loadAllClubs() {
        this.loadingClubs = true;
        this.cdr.markForCheck();
        this.clubService.getClubs().subscribe({
            next: (clubs) => {
                this.allClubs = clubs;
                this.loadingClubs = false;
                this.cdr.markForCheck();
            },
            error: () => {
                this.loadingClubs = false;
                this.cdr.markForCheck();
            }
        });
    }

    createNewClub() {
        if (!this.newClubName || this.creatingClub) return;
        this.creatingClub = true;
        this.createClubError = '';
        this.createClubSuccess = '';
        this.cdr.markForCheck();

        this.clubService.createClub({
            name: this.newClubName,
            description: this.newClubDescription || undefined,
        }).subscribe({
            next: (club) => {
                this.createClubSuccess = `Club "${club.name}" creado correctamente con su schema.`;
                this.newClubName = '';
                this.newClubDescription = '';
                this.creatingClub = false;
                this.loadAllClubs();
                this.cdr.markForCheck();
            },
            error: (err) => {
                this.createClubError = err.error?.message || 'Error al crear el club';
                this.creatingClub = false;
                this.cdr.markForCheck();
            }
        });
    }

    toggleClubActive(club: Club) {
        const newState = club.isActive === false ? true : false;
        this.clubService.toggleActive(club.id, newState).subscribe({
            next: (updated) => {
                // Update in the list
                const idx = this.allClubs.findIndex(c => c.id === club.id);
                if (idx >= 0) this.allClubs[idx] = { ...this.allClubs[idx], isActive: updated.isActive };
                // If this is the selected club, update it too
                if (this.club?.id === club.id) {
                    this.clubService.selectClub({ ...this.club, isActive: updated.isActive });
                }
                this.cdr.markForCheck();
            },
            error: (err) => console.error('Error toggling club active state', err),
        });
    }

    switchToClub(club: Club) {
        this.clubService.selectClub(club);
        this.cdr.markForCheck();
    }
}
