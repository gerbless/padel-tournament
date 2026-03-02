import { Injectable, inject, DestroyRef } from '@angular/core';
import { BehaviorSubject, combineLatest, Observable } from 'rxjs';
import { map, distinctUntilChanged } from 'rxjs/operators';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ClubService } from './club.service';
import { AuthService } from './auth.service';
import { DEFAULT_ENABLED_MODULES, EnabledModules } from '../models/club.model';

/**
 * Module key → matches sidebar items and enabledModules keys.
 */
export type ModuleKey = keyof EnabledModules;

/**
 * Defines a sidebar navigation item with role-based visibility rules.
 */
export interface NavItem {
    path: string;
    icon: string;
    label: string;
    moduleKey: ModuleKey;
    /** Minimum role required to see this item. 'public' means visible without login. */
    minRole: 'public' | 'viewer' | 'editor' | 'admin';
    /** If true, non-authenticated users can see this item when the module is enabled. */
    publicVisible: boolean;
}

/**
 * All sidebar items with their visibility rules.
 * Order here = order in the sidebar.
 */
export const SIDEBAR_ITEMS: NavItem[] = [
    { path: '/dashboard',    icon: '📊', label: 'Estadísticas',     moduleKey: 'dashboard',     minRole: 'viewer',  publicVisible: false },
    { path: '/tournaments',  icon: '🏆', label: 'Torneos',          moduleKey: 'tournaments',   minRole: 'public',  publicVisible: true  },
    { path: '/leagues',      icon: '🏆', label: 'Ligas',            moduleKey: 'leagues',       minRole: 'public',  publicVisible: true  },
    { path: '/courts',       icon: '🏟️', label: 'Canchas',          moduleKey: 'courts',        minRole: 'editor',  publicVisible: false },
    { path: '/players',      icon: '👥', label: 'Jugadores',        moduleKey: 'players',       minRole: 'viewer',  publicVisible: false },
    { path: '/ranking',      icon: '🥇', label: 'Ranking',          moduleKey: 'ranking',       minRole: 'public',  publicVisible: true  },
    { path: '/estadisticas', icon: '📅', label: 'Ranking Mensual',  moduleKey: 'estadisticas',  minRole: 'viewer',  publicVisible: false },
];

@Injectable({ providedIn: 'root' })
export class PermissionsService {
    private destroyRef = inject(DestroyRef);

    /** Emits the list of visible nav items whenever club, user, or modules change. */
    public visibleNavItems$: Observable<NavItem[]>;

    /** Is the current user an admin (club admin or super_admin) for the selected club? */
    public isClubAdmin$: Observable<boolean>;

    /** Is the current user super_admin? */
    public isSuperAdmin$: Observable<boolean>;

    constructor(
        private clubService: ClubService,
        private authService: AuthService,
    ) {
        this.isSuperAdmin$ = this.authService.currentUser$.pipe(
            map(u => u?.role === 'super_admin'),
            distinctUntilChanged(),
        );

        this.isClubAdmin$ = combineLatest([
            this.clubService.selectedClub$,
            this.authService.currentUser$,
        ]).pipe(
            map(([club, user]) => {
                if (!user) return false;
                if (user.role === 'super_admin') return true;
                if (!club) return false;
                return this.authService.hasClubRole(club.id, 'admin');
            }),
            distinctUntilChanged(),
        );

        this.visibleNavItems$ = combineLatest([
            this.clubService.selectedClub$,
            this.authService.currentUser$,
        ]).pipe(
            map(([club, user]) => this.computeVisibleItems(club, user)),
        );
    }

    /**
     * Compute which nav items should be visible given:
     * - Which modules the club has enabled
     * - The user's role for the selected club (or no user)
     */
    private computeVisibleItems(club: any, user: any): NavItem[] {
        // No club selected → show nothing (they're on club selection)
        if (!club) return [];

        const modules: EnabledModules = { ...DEFAULT_ENABLED_MODULES, ...(club.enabledModules || {}) };
        const isSuperAdmin = user?.role === 'super_admin';

        // Super admin sees everything regardless of module config
        if (isSuperAdmin) {
            return [...SIDEBAR_ITEMS];
        }

        // Determine the user's effective role for this club
        const userRole = user ? this.authService.getClubRole(club.id) : null;
        const roleLevel = this.getRoleLevel(userRole);

        return SIDEBAR_ITEMS.filter(item => {
            // Module must be enabled for this club
            if (!modules[item.moduleKey]) return false;

            // Check role level
            const requiredLevel = this.getRoleLevel(item.minRole);

            if (!user) {
                // Not logged in → only public items
                return item.publicVisible;
            }

            // Logged in → check role level
            return roleLevel >= requiredLevel;
        });
    }

    private getRoleLevel(role: string | null): number {
        const levels: Record<string, number> = {
            'public': 0,
            'viewer': 1,
            'editor': 2,
            'admin': 3,
            'super_admin': 4,
        };
        return levels[role || 'public'] || 0;
    }

    /**
     * Check if a specific module is enabled for the currently selected club.
     */
    isModuleEnabled(moduleKey: ModuleKey): Observable<boolean> {
        return this.clubService.selectedClub$.pipe(
            map(club => {
                if (!club) return false;
                const modules = { ...DEFAULT_ENABLED_MODULES, ...(club.enabledModules || {}) };
                return modules[moduleKey];
            }),
            distinctUntilChanged(),
        );
    }

    /**
     * Check if the current user can access admin features for the selected club.
     */
    canAdminCurrentClub(): boolean {
        const club = this.clubService.getSelectedClub();
        if (!club) return false;
        return this.authService.hasClubRole(club.id, 'admin') || this.authService.isSuperAdmin();
    }
}
