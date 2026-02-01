import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive, Router } from '@angular/router';
import { LayoutService } from '../../../services/layout.service';
import { ClubService } from '../../../services/club.service';
import { Club } from '../../../models/club.model';
import { AuthService } from '../../../services/auth.service';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [CommonModule, RouterLink, RouterLinkActive],
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
                <span class="title" *ngIf="!selectedClub">PADEL MGR</span>
                
                <div class="club-info" *ngIf="selectedClub">
                    <span class="club-name" title="{{ selectedClub.name }}">{{ selectedClub.name }}</span>
                    <a class="change-link" (click)="clearClub()">Cambiar Club</a>
                </div>
            </div>
        </div>
        
        <button class="toggle-btn" (click)="toggleSidebar()">
            {{ isCollapsed ? '▶' : '◀' }}
        </button>

        <nav class="nav-menu">
            <a routerLink="/dashboard" routerLinkActive="active" class="nav-item" (click)="closeMobileMenu()">
                <span class="icon">📊</span>
                <span class="label" *ngIf="!isCollapsed">Estadísticas</span>
            </a>
            <a routerLink="/tournaments" routerLinkActive="active" class="nav-item" (click)="closeMobileMenu()">
                <span class="icon">🏆</span>
                <span class="label" *ngIf="!isCollapsed">Torneos</span>
            </a>
            <a routerLink="/leagues" routerLinkActive="active" class="nav-item" (click)="closeMobileMenu()">
                <span class="icon">🏆</span>
                <span class="label" *ngIf="!isCollapsed">Ligas</span>
            </a>
            <a routerLink="/players" routerLinkActive="active" class="nav-item" (click)="closeMobileMenu()">
                <span class="icon">👥</span>
                <span class="label" *ngIf="!isCollapsed">Jugadores</span>
            </a>
            <a routerLink="/ranking" routerLinkActive="active" class="nav-item" (click)="closeMobileMenu()">
                <span class="icon">🥇</span>
                <span class="label" *ngIf="!isCollapsed">Ranking</span>
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
                <p>v1.2.0</p>
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

    constructor(
        private layoutService: LayoutService,
        private clubService: ClubService,
        private authService: AuthService,
        private router: Router
    ) {
        this.layoutService.sidebarCollapsed$.subscribe(
            (collapsed: boolean) => this.isCollapsed = collapsed
        );
        this.layoutService.mobileMenuOpen$.subscribe(
            (open: boolean) => this.isMobileOpen = open
        );
        this.authService.currentUser$.subscribe((user: any) => {
            this.isLoggedIn = !!user;
        });
    }

    ngOnInit() {
        this.clubService.selectedClub$.subscribe(club => {
            this.selectedClub = club;
        });
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
}
