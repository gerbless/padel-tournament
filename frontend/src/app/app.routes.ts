import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
    { path: '', loadComponent: () => import('./components/club-selection/club-selection.component').then(m => m.ClubSelectionComponent) },
    { path: 'login', loadComponent: () => import('./components/login/login.component').then(m => m.LoginComponent) },
    {
        path: 'dashboard',
        loadComponent: () => import('./components/dashboard/dashboard.component').then(m => m.DashboardComponent)
    },
    {
        path: 'tournaments',
        children: [
            { path: '', loadComponent: () => import('./components/tournament-list/tournament-list.component').then(m => m.TournamentListComponent) },
            { path: 'create', loadComponent: () => import('./components/tournament-create/tournament-create.component').then(m => m.TournamentCreateComponent), canActivate: [authGuard] },
            { path: ':id', loadComponent: () => import('./components/tournament-detail/tournament-detail.component').then(m => m.TournamentDetailComponent) },
        ]
    },
    {
        path: 'leagues',
        children: [
            { path: '', loadComponent: () => import('./modules/league/components/league-list/league-list.component').then(m => m.LeagueListComponent) },
            { path: 'create', loadComponent: () => import('./modules/league/components/league-create/league-create.component').then(m => m.LeagueCreateComponent), canActivate: [authGuard] },
            { path: ':id', loadComponent: () => import('./modules/league/components/league-dashboard/league-dashboard.component').then(m => m.LeagueDashboardComponent) },
        ]
    },
    {
        path: 'players',
        loadComponent: () => import('./components/player-list/player-list.component').then(m => m.PlayerListComponent)
    },
    {
        path: 'ranking',
        loadComponent: () => import('./components/ranking/ranking.component').then(m => m.RankingComponent)
    },
    {
        path: 'estadisticas',
        loadComponent: () => import('./components/estadisticas/estadisticas.component').then(m => m.EstadisticasComponent)
    },
    {
        path: 'personal-tracker',
        loadChildren: () => import('./modules/personal-tracker/personal-tracker.routes').then(m => m.PERSONAL_TRACKER_ROUTES),
        canActivate: [authGuard]
    },
    {
        path: 'categories',
        loadChildren: () => import('./modules/categories/categories.module').then(m => m.CategoriesModule)
    },
    {
        path: 'courts',
        children: [
            { path: '', loadComponent: () => import('./modules/courts/components/court-management/court-management.component').then(m => m.CourtManagementComponent) },
            { path: 'daily', loadComponent: () => import('./modules/courts/components/court-daily-view/court-daily-view.component').then(m => m.CourtDailyViewComponent) },
            { path: ':courtId/calendar', loadComponent: () => import('./modules/courts/components/court-calendar/court-calendar.component').then(m => m.CourtCalendarComponent) },
        ]
    },
];
