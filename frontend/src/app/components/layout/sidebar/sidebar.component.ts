import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { LayoutService } from '../../../services/layout.service';

@Component({
    selector: 'app-sidebar',
    standalone: true,
    imports: [CommonModule, RouterLink, RouterLinkActive],
    template: `
    <aside class="sidebar" [class.collapsed]="isCollapsed">
        <div class="brand">
            <span class="logo">🎾</span>
            <span class="title" *ngIf="!isCollapsed">PADEL MGR</span>
        </div>
        
        <button class="toggle-btn" (click)="toggleSidebar()">
            {{ isCollapsed ? '▶' : '◀' }}
        </button>

        <nav class="nav-menu">
            <a routerLink="/dashboard" routerLinkActive="active" class="nav-item">
                <span class="icon">📊</span>
                <span class="label" *ngIf="!isCollapsed">Dashboard</span>
            </a>
            <a routerLink="/tournaments" routerLinkActive="active" class="nav-item">
                <span class="icon">🏆</span>
                <span class="label" *ngIf="!isCollapsed">Torneos</span>
            </a>
            <a routerLink="/leagues" routerLinkActive="active" class="nav-item">
                <span class="icon">🏆</span>
                <span class="label" *ngIf="!isCollapsed">Ligas</span>
            </a>
            <a routerLink="/players" routerLinkActive="active" class="nav-item">
                <span class="icon">👥</span>
                <span class="label" *ngIf="!isCollapsed">Jugadores</span>
            </a>
            <a routerLink="/ranking" routerLinkActive="active" class="nav-item">
                <span class="icon">🥇</span>
                <span class="label" *ngIf="!isCollapsed">Ranking</span>
            </a>
        </nav>

        <div class="footer" *ngIf="!isCollapsed">
            <p>v1.2.0</p>
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
            position: fixed;
            left: 0;
            top: 0;
            color: white;
            z-index: 100;
            transition: width 0.3s ease;
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
            height: 40px;
            overflow: hidden;
        }

        .brand .logo {
            min-width: 40px;
            text-align: center;
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
    `]
})
export class SidebarComponent {
    isCollapsed = false;

    constructor(private layoutService: LayoutService) {
        this.layoutService.sidebarCollapsed$.subscribe(
            collapsed => this.isCollapsed = collapsed
        );
    }

    toggleSidebar() {
        this.layoutService.toggleSidebar();
    }
}
