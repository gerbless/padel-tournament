import { Component } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  template: `
    <nav class="navbar">
      <div class="brand">PADEL MANAGER</div>
      <div class="nav-links">
        <a routerLink="/tournaments" routerLinkActive="active">Torneos</a>
        <a routerLink="/players" routerLinkActive="active">Jugadores</a>
        <a routerLink="/ranking" routerLinkActive="active">Ranking Global</a>
      </div>
    </nav>
    <router-outlet></router-outlet>
    `,
  styles: []
})
export class AppComponent {
  title = 'Padel Tournament Manager';
}
