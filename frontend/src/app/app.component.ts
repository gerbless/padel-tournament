import { Component, OnInit } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './components/layout/sidebar/sidebar.component';
import { LayoutService } from './services/layout.service';
import { ThemeService } from './services/theme.service';
import { filter } from 'rxjs/operators';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, CommonModule, SidebarComponent],
    template: `
    <div class="app-layout">
        <app-sidebar *ngIf="showSidebar"></app-sidebar>
        <main class="main-content" [class.expanded]="sidebarCollapsed" [class.no-sidebar]="!showSidebar">
            <header class="mobile-header" *ngIf="showSidebar">
                <button class="menu-fab" (click)="toggleMobileMenu()">
                    ☰
                </button>
                <div class="mobile-title">PADEL MGR</div>
            </header>
            <router-outlet></router-outlet>
        </main>
        
        <!-- Theme Toggle Button -->
        <button class="theme-toggle" (click)="toggleTheme()" [title]="themeService.darkMode() ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'">
            <span *ngIf="!themeService.darkMode()">🌙</span>
            <span *ngIf="themeService.darkMode()">☀️</span>
        </button>
    </div>
    `,
    styles: [`
        .app-layout {
            display: flex;
            min-height: 100vh;
        }
        
        .main-content {
            flex: 1;
            margin-left: 240px;
            padding: 2rem;
            width: calc(100% - 240px);
            transition: margin-left 0.3s ease, width 0.3s ease;
        }

        .main-content.expanded {
            margin-left: 80px;
            width: calc(100% - 80px);
        }

        .main-content.no-sidebar {
            margin-left: 0 !important;
            width: 100% !important;
            padding: 0; 
        }

        .mobile-header {
            display: none;
            align-items: center;
            gap: 1rem;
            margin-bottom: 1.5rem;
        }

        .menu-fab {
            background: var(--primary);
            color: white;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.2rem;
            box-shadow: 0 2px 5px rgba(0,0,0,0.2);
            cursor: pointer;
        }

        .mobile-title {
            font-weight: bold;
            font-size: 1.2rem;
            color: var(--text-primary);
        }

        @media (max-width: 768px) {
            .main-content {
                margin-left: 0;
                padding: 1rem;
                padding-bottom: 80px;
                width: 100%;
            }
            .main-content.expanded {
                margin-left: 0;
                width: 100%;
            }

            .mobile-header {
                display: flex;
            }
        }
    `]
})
export class AppComponent implements OnInit {
    title = 'Padel Tournament Manager';
    sidebarCollapsed = false;
    showSidebar = true;

    constructor(
        private layoutService: LayoutService,
        public themeService: ThemeService,
        private router: Router
    ) {
        this.layoutService.sidebarCollapsed$.subscribe(
            (collapsed: boolean) => this.sidebarCollapsed = collapsed
        );
    }

    ngOnInit() {
        // Hide sidebar on landing page (/)
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
        ).subscribe((event: any) => {
            this.showSidebar = event.url !== '/' && event.url !== '/club-selection';
        });
    }

    toggleTheme() {
        this.themeService.toggleTheme();
    }

    toggleMobileMenu() {
        this.layoutService.toggleMobileMenu();
    }
}
