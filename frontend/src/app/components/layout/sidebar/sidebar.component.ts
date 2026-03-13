import { Component, OnInit, DestroyRef, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LayoutService } from '../../../services/layout.service';
import { ClubService } from '../../../services/club.service';
import { Club } from '../../../models/club.model';
import { AuthService } from '../../../services/auth.service';
import { PermissionsService, NavItem } from '../../../services/permissions.service';
import { environment } from '../../../../environments/environment';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [CommonModule, RouterLink, RouterLinkActive],
    changeDetection: ChangeDetectionStrategy.OnPush,
    template: `
    <div class="sidebar-overlay" *ngIf="isMobileOpen" (click)="closeMobileMenu()"></div>
    <aside class="sidebar" [class.collapsed]="isCollapsed" [class.mobile-open]="isMobileOpen">
        <div class="brand">
            <!-- Default Logo -->
            <span class="logo" *ngIf="!selectedClub">🎾</span>
            <!-- Club Context Logo (Initials) -->
            <div class="club-logo-circle" *ngIf="selectedClub">
                {{ selectedClub.name.charAt(0).toUpperCase() }}
            </div>

            <div class="brand-content" *ngIf="!isCollapsed">
                <span class="title" *ngIf="!selectedClub">Agon Padel</span>
                
                <div class="club-info" *ngIf="selectedClub">
                    <span class="club-name" title="{{ selectedClub.name }}">{{ selectedClub.name }}</span>
                    <span class="club-role-badge" *ngIf="clubRole">{{ clubRole === 'admin' ? '🔑 Admin' : clubRole === 'editor' ? '✏️ Editor' : '👁️' }}</span>
                    <a class="change-link" (click)="clearClub()">Cambiar Club</a>
                </div>
            </div>
        </div>
        
        <button class="toggle-btn" (click)="toggleSidebar()">
            {{ isCollapsed ? '▶' : '◀' }}
        </button>

        <nav class="nav-menu">
            <!-- Dynamic nav items based on permissions -->
            <a *ngFor="let item of visibleNavItems"
               [routerLink]="item.path"
               routerLinkActive="active"
               class="nav-item"
               (click)="closeMobileMenu()">
                <span class="icon">{{ item.icon }}</span>
                <span class="label" *ngIf="!isCollapsed">{{ item.label }}</span>
            </a>

            <!-- Admin Settings (super_admin only) -->
            <a *ngIf="isSuperAdmin && selectedClub"
               routerLink="/admin/club-settings"
               routerLinkActive="active"
               class="nav-item admin-item"
               (click)="closeMobileMenu()">
                <span class="icon">⚙️</span>
                <span class="label" *ngIf="!isCollapsed">Configuración</span>
            </a>

            <!-- Player Portal Section -->
            <div *ngIf="selectedClub" class="divider" style="height: 1px; background: rgba(255,255,255,0.1); margin: 0.5rem 0;"></div>
            <div *ngIf="selectedClub && !isCollapsed" class="nav-section-label" style="padding: 0.25rem 1rem; font-size: 0.7rem; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 1px;">Jugador</div>

            <a *ngIf="canBookCourt && selectedClub && !isSuperAdmin && !clubRole"
               routerLink="/player/booking"
               routerLinkActive="active"
               class="nav-item"
               (click)="closeMobileMenu()">
                <span class="icon">🏟️</span>
                <span class="label" *ngIf="!isCollapsed">Reservar Cancha</span>
            </a>
            <a *ngIf="isLoggedIn && selectedClub && !isSuperAdmin && !clubRole"
               routerLink="/player/my-bookings"
               routerLinkActive="active"
               class="nav-item"
               (click)="closeMobileMenu()">
                <span class="icon">📋</span>
                <span class="label" *ngIf="!isCollapsed">Mis Reservas</span>
            </a>
            <a *ngIf="isLoggedIn && selectedClub && !isSuperAdmin && !clubRole"
               routerLink="/player/profile"
               routerLinkActive="active"
               class="nav-item"
               (click)="closeMobileMenu()">
                <span class="icon">👤</span>
                <span class="label" *ngIf="!isCollapsed">Mi Perfil</span>
            </a>

            <div class="divider" style="height: 1px; background: rgba(255,255,255,0.1); margin: 0.5rem 0;"></div>

            <a *ngIf="!isLoggedIn" routerLink="/login" class="nav-item" (click)="closeMobileMenu()" style="color: var(--primary);">
                <span class="icon">🔐</span>
                <span class="label" *ngIf="!isCollapsed">Iniciar Sesión</span>
            </a>
            <a *ngIf="isLoggedIn" (click)="logout()" class="nav-item" style="color: var(--error); cursor: pointer;">
                <span class="icon">🚪</span>
                <span class="label" *ngIf="!isCollapsed">Cerrar Sesión</span>
            </a>
        </nav>

        <div class="footer">
            <div *ngIf="!isCollapsed">
                <p>v1.3.0</p>
            </div>
        </div>
    </aside>
    `,
    styles: [`
        .sidebar {
            width: 240px;
            height: 100vh;
            background: rgba(15, 23, 42, 0.95);
            backdrop-filter: blur(10px);
            border-right: 1px solid rgba(255, 255, 255, 0.1);
            display: flex;
            flex-direction: column;
            padding: 1.5rem;
            padding-top: calc(1.5rem + var(--sat)); /* Safe area support */
            position: fixed;
            left: 0;
            top: 0;
            color: white;
            z-index: 100;
            transition: transform 0.3s ease, width 0.3s ease;
        }

        .sidebar.collapsed {
            width: 80px;
            padding: 1.5rem 0.5rem;
        }

        .brand {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            margin-bottom: 2rem;
            padding-left: 0.5rem;
            min-height: 48px; /* Fixed height to prevent jumps */
            overflow: hidden;
        }

        .brand .logo {
            min-width: 40px;
            text-align: center;
            font-size: 1.5rem;
        }

        .club-logo-circle {
            min-width: 40px;
            height: 40px;
            background: var(--primary);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 1.2rem;
            color: white;
            box-shadow: 0 0 10px rgba(var(--primary-rgb), 0.3);
        }

        .brand-content {
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }

        .title {
            font-weight: bold;
            font-size: 1.2rem;
            white-space: nowrap;
        }

        .club-info {
            display: flex;
            flex-direction: column;
            line-height: 1.2;
        }

        .club-name {
            font-weight: 600;
            font-size: 0.95rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            max-width: 140px;
            color: white;
        }

        .change-link {
            font-size: 0.75rem;
            color: var(--text-secondary);
            cursor: pointer;
            text-decoration: underline;
            transition: color 0.2s;
        }

        .change-link:hover {
            color: var(--primary);
        }

        .club-role-badge {
            display: inline-block;
            font-size: 0.65rem;
            font-weight: 600;
            padding: 0.1rem 0.4rem;
            border-radius: 999px;
            background: rgba(16, 185, 129, 0.2);
            color: var(--primary);
            margin-top: 0.15rem;
        }

        .toggle-btn {
            position: absolute;
            top: 20px;
            right: -15px;
            background: var(--primary);
            border: none;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: white;
            font-size: 0.8rem;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            z-index: 10;
        }

        .nav-menu {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            flex: 1;
            overflow: hidden;
        }

        .nav-item {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 0.875rem 1rem;
            color: var(--text-secondary);
            text-decoration: none;
            border-radius: 0.75rem;
            transition: all 0.2s ease;
            font-weight: 500;
            white-space: nowrap;
        }

        .sidebar.collapsed .nav-item {
            justify-content: center;
            padding: 0.875rem 0;
        }

        .nav-item:hover {
            background: var(--bg-tertiary);
            color: var(--text-primary);
            transform: translateX(4px);
        }

        .sidebar.collapsed .nav-item:hover {
            transform: none;
            background: var(--bg-tertiary);
        }

        .nav-item.active {
            background: linear-gradient(90deg, rgba(16, 185, 129, 0.15) 0%, transparent 100%);
            color: var(--primary);
            border-left: 3px solid var(--primary);
        }

        .sidebar.collapsed .nav-item.active {
            border-left: none;
            background: rgba(16, 185, 129, 0.15);
        }

        .nav-item .icon {
            font-size: 1.25rem;
            width: 24px;
            text-align: center;
            display: inline-block;
        }

        .admin-item {
            margin-top: 0.25rem;
            border-top: 1px solid rgba(255,255,255,0.06);
            padding-top: 0.75rem;
        }
        .admin-item .label {
            color: var(--primary);
        }

        .footer {
            margin-top: auto;
            padding-top: 1rem;
            border-top: 1px solid var(--border);
            color: var(--text-muted);
            font-size: 0.75rem;
            text-align: center;
        }

        .sidebar-overlay {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            z-index: 99;
            backdrop-filter: blur(2px);
        }

        @media (max-width: 768px) {
            .sidebar {
                transform: translateX(-100%);
                width: 280px !important; /* Full width or wider on mobile */
            }
            
            .sidebar.mobile-open {
                transform: translateX(0);
            }

            .sidebar-overlay {
                display: block;
            }

            .toggle-btn {
                display: none; /* Hide toggle button on mobile */
            }
            
            .brand {
                margin-top: 1rem;
            }
        }
    `]
})
export class SidebarComponent implements OnInit {
    isCollapsed = false;
    isMobileOpen = false;
    selectedClub: Club | null = null;

    isLoggedIn = false;
    clubRole: string | null = null;
    isAdmin = false;
    isSuperAdmin = false;
    canBookCourt = false;
    visibleNavItems: NavItem[] = [];

    private destroyRef = inject(DestroyRef);

    private cdr = inject(ChangeDetectorRef);

    constructor(
        private layoutService: LayoutService,
        private clubService: ClubService,
        private authService: AuthService,
        private permissionsService: PermissionsService,
        private router: Router,
        private http: HttpClient,
    ) {
        this.layoutService.sidebarCollapsed$.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(
            (collapsed: boolean) => {
                this.isCollapsed = collapsed;
                this.cdr.markForCheck();
            }
        );
        this.layoutService.mobileMenuOpen$.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(
            (open: boolean) => {
                this.isMobileOpen = open;
                this.cdr.markForCheck();
            }
        );
        this.authService.currentUser$.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe((user: any) => {
            this.isLoggedIn = !!user;
            if (user) {
                this.loadVerificationStatus();
            } else {
                this.canBookCourt = false;
            }
            this.cdr.markForCheck();
        });
    }

    ngOnInit() {
        this.clubService.selectedClub$.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(club => {
            this.selectedClub = club;
            this.updateClubRole();
            this.cdr.markForCheck();
        });
        this.authService.currentUser$.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(() => {
            this.updateClubRole();
            this.cdr.markForCheck();
        });

        // Subscribe to dynamic nav items from PermissionsService
        this.permissionsService.visibleNavItems$.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(items => {
            this.visibleNavItems = items;
            this.cdr.markForCheck();
        });

        this.permissionsService.isClubAdmin$.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(isAdmin => {
            this.isAdmin = isAdmin;
            this.cdr.markForCheck();
        });

        this.permissionsService.isSuperAdmin$.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(isSuperAdmin => {
            this.isSuperAdmin = isSuperAdmin;
            this.cdr.markForCheck();
        });
    }

    private updateClubRole(): void {
        if (this.selectedClub && this.isLoggedIn) {
            this.clubRole = this.authService.getClubRole(this.selectedClub.id);
        } else {
            this.clubRole = null;
        }
    }

    logout() {
        this.authService.logout();
        this.router.navigate(['/']);
    }

    toggleSidebar() {
        this.layoutService.toggleSidebar();
    }

    closeMobileMenu() {
        this.layoutService.closeMobileMenu();
    }

    clearClub() {
        this.clubService.clearSelectedClub();
        this.router.navigate(['/']);
        this.closeMobileMenu();
    }

    private loadVerificationStatus(): void {
        this.http.get<any>(`${environment.apiUrl}/players/me`).subscribe({
            next: (profile) => {
                this.canBookCourt = !!(profile?.isEmailVerified && profile?.isPhoneVerified);
                this.cdr.markForCheck();
            },
            error: () => {
                this.canBookCourt = false;
                this.cdr.markForCheck();
            }
        });
    }
}
