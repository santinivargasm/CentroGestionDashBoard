import { Routes } from '@angular/router';
import { GetApi } from './get-api/get-api';

export const routes: Routes = [
    {
        path: '',
        redirectTo: 'dashboard',
        pathMatch: 'full'
    },
    {
        path: 'dashboard',
        loadComponent: () =>
            import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent)
    },

    {
        path: 'formularios',
        loadComponent: () =>
            import('./pages/formularios/formularios.component').then(m => m.formulariosComponent)
    },

    {
        path: 'login',
        loadComponent: () =>
            import('./pages/login/login.component').then(m => m.loginComponent)
    },
    {
        path: 'history-user/:id',
        loadComponent: () =>
            import('./pages/history-user/history-user.component').then(m => m.HistoryUserComponent)
    }

];
