import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { SidebarComponent } from './components/layout/sidebar/sidebar.component';
import { LayoutService } from './services/layout.service';

@Component({
    selector: 'app-root',
    standalone: true,
    imports: [RouterOutlet, CommonModule, SidebarComponent],
    template: `
    <div class="app-layout">
        <app-sidebar></app-sidebar>
        <main class="main-content" [class.expanded]="sidebarCollapsed">
            <router-outlet></router-outlet>
        </main>
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

        @media (max-width: 768px) {
            .main-content {
                margin-left: 0;
                padding-bottom: 80px;
                width: 100%;
            }
            .main-content.expanded {
                margin-left: 0;
                width: 100%;
            }
        }
    `]
})
export class AppComponent {
    title = 'Padel Tournament Manager';
    sidebarCollapsed = false;

    constructor(private layoutService: LayoutService) {
        this.layoutService.sidebarCollapsed$.subscribe(
            collapsed => this.sidebarCollapsed = collapsed
        );
    }
}
