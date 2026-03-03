import { Routes } from '@angular/router';
import { authGuard } from './guards/auth.guard';
import { superAdminGuard } from './guards/super-admin.guard';

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
            { path: 'billing', loadComponent: () => import('./modules/courts/components/court-billing/court-billing.component').then(m => m.CourtBillingComponent) },
            { path: ':courtId/calendar', loadComponent: () => import('./modules/courts/components/court-calendar/court-calendar.component').then(m => m.CourtCalendarComponent) },
        ]
    },
    {
        path: 'admin/club-settings',
        loadComponent: () => import('./components/admin/club-settings/club-settings.component').then(m => m.ClubSettingsComponent),
        canActivate: [superAdminGuard]
    },
    {
        path: 'register',
        loadComponent: () => import('./components/register/register.component').then(m => m.RegisterComponent)
    },
    {
        path: 'player/booking',
        loadComponent: () => import('./modules/player-portal/player-booking/player-booking.component').then(m => m.PlayerBookingComponent)
    },
    {
        path: 'player/profile',
        loadComponent: () => import('./modules/player-portal/player-profile/player-profile.component').then(m => m.PlayerProfileComponent),
        canActivate: [authGuard]
    },
    {
        path: 'player/my-bookings',
        loadComponent: () => import('./modules/player-portal/my-bookings/my-bookings.component').then(m => m.MyBookingsComponent),
        canActivate: [authGuard]
    },
];
