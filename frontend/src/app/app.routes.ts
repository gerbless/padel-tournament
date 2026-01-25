import { Routes } from '@angular/router';
import { TournamentListComponent } from './components/tournament-list/tournament-list.component';
import { TournamentCreateComponent } from './components/tournament-create/tournament-create.component';
import { TournamentDetailComponent } from './components/tournament-detail/tournament-detail.component';

export const routes: Routes = [
    { path: '', redirectTo: '/tournaments', pathMatch: 'full' },
    { path: 'tournaments', component: TournamentListComponent },
    { path: 'tournaments/create', component: TournamentCreateComponent },
    { path: 'tournaments/:id', component: TournamentDetailComponent },
];
