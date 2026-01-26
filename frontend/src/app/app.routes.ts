import { Routes } from '@angular/router';
import { TournamentListComponent } from './components/tournament-list/tournament-list.component';
import { TournamentCreateComponent } from './components/tournament-create/tournament-create.component';
import { TournamentDetailComponent } from './components/tournament-detail/tournament-detail.component';
import { RankingComponent } from './components/ranking/ranking.component';
import { PlayerListComponent } from './components/player-list/player-list.component';
import { PlayerProfileComponent } from './components/player-profile/player-profile.component';
import { DashboardComponent } from './components/dashboard/dashboard.component';
import { LeagueListComponent } from './modules/league/components/league-list/league-list.component';
import { LeagueCreateComponent } from './modules/league/components/league-create/league-create.component';
import { LeagueDashboardComponent } from './modules/league/components/league-dashboard/league-dashboard.component';

export const routes: Routes = [
    { path: '', redirectTo: '/dashboard', pathMatch: 'full' },
    { path: 'dashboard', component: DashboardComponent },
    { path: 'tournaments', component: TournamentListComponent },
    { path: 'tournaments/create', component: TournamentCreateComponent },
    { path: 'tournaments/:id', component: TournamentDetailComponent },
    { path: 'leagues', component: LeagueListComponent },
    { path: 'leagues/create', component: LeagueCreateComponent },
    { path: 'leagues/:id', component: LeagueDashboardComponent },
    { path: 'players', component: PlayerListComponent },
    { path: 'players', component: PlayerListComponent },
    { path: 'ranking', component: RankingComponent },
    { path: 'categories', loadChildren: () => import('./modules/categories/categories.module').then(m => m.CategoriesModule) },
];
