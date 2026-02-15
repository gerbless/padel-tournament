import { Component, OnInit, DestroyRef, inject, ChangeDetectionStrategy, ChangeDetectorRef } from '@angular/core';
import { RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { CommonModule } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { SidebarComponent } from './components/layout/sidebar/sidebar.component';
import { ToastComponent } from './components/toast/toast.component';
import { LayoutService } from './services/layout.service';
import { ThemeService } from './services/theme.service';
import { filter } from 'rxjs/operators';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, CommonModule, SidebarComponent, ToastComponent],
    changeDetection: ChangeDetectionStrategy.OnPush,
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
        <app-toast></app-toast>
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
            position: sticky;
            top: 0;
            z-index: 90;
            background: rgba(255, 255, 255, 0.85); /* Fallback */
            background: var(--glass-bg);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            padding: calc(0.5rem + var(--sat)) 1rem 0.5rem 1rem; /* Top padding adds safe area */
            margin: -2rem -2rem 1.5rem -2rem; /* Negative margin to stretch full width of container padding */
            border-bottom: 1px solid var(--glass-border);
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
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
            cursor: pointer;
            flex-shrink: 0;
        }

        .mobile-title {
            font-weight: 800;
            font-size: 1.25rem;
            color: var(--text-primary);
            letter-spacing: -0.025em;
        }

        /* Theme Toggle Adjustment for Safe Area */
        .theme-toggle {
            bottom: calc(2rem + var(--sab)); /* Safe area bottom supported */
            right: 2rem;
        }

        @media (max-width: 768px) {
            .main-content {
                margin-left: 0;
                padding: 0; /* Reset padding, manage inside */
                padding-bottom: calc(80px + var(--sab));
                width: 100%;
            }
            
            /* Content wrapper inside main for padding if needed, or apply directly */
            .main-content > router-outlet + * {
                 /* This selector is tricky, better to just padding the container elements in pages 
                    OR add padding to router-outlet wrapper if one existed.
                    But waiting, the styling above had padding: 2rem initially.
                    Let's restore some padding but keep header full width.
                 */
            }
            
            .mobile-header {
                display: flex;
                margin: 0; /* Reset negative margins as we removed parent padding */
                width: 100%;
            }

            .main-content.expanded {
                margin-left: 0;
                width: 100%;
            }
        }
    `]
})
export class AppComponent implements OnInit {
    title = 'Padel Tournament Manager';
    sidebarCollapsed = false;
    showSidebar = true;

    private destroyRef = inject(DestroyRef);

    private cdr = inject(ChangeDetectorRef);

    constructor(
        private layoutService: LayoutService,
        public themeService: ThemeService,
        private router: Router
    ) {
        this.layoutService.sidebarCollapsed$.pipe(
            takeUntilDestroyed(this.destroyRef)
        ).subscribe(
            (collapsed: boolean) => {
                this.sidebarCollapsed = collapsed;
                this.cdr.markForCheck();
            }
        );
    }

    ngOnInit() {
        // Hide sidebar on landing page (/)
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd),
            takeUntilDestroyed(this.destroyRef)
        ).subscribe((event: any) => {
            this.showSidebar = event.url !== '/' && event.url !== '/club-selection';
            this.cdr.markForCheck();
        });
    }

    toggleTheme() {
        this.themeService.toggleTheme();
    }

    toggleMobileMenu() {
        this.layoutService.toggleMobileMenu();
    }
}
