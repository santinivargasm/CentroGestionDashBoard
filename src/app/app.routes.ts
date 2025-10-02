import { Routes } from '@angular/router';

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
      import('./pages/formularios/formularios.component').then(m => m.FormulariosComponent)
  },
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then(m => m.loginComponent) // o LoginComponent si lo renombras
  },
  {
    path: 'history-user/:id',
    loadComponent: () =>
      import('./pages/history-user/history-user.component').then(m => m.HistoryUserComponent)
  }
];
