import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', redirectTo: 'dashboard', pathMatch: 'full' },

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
  // Aquí usamos el símbolo EXACTO que exporta tu login (minúscula)
  {
    path: 'login',
    loadComponent: () =>
      import('./pages/login/login.component').then(m => m.loginComponent)
  },
  {
    path: 'history-user/:id',
    loadComponent: () =>
      import('./pages/history-user/history-user.component').then(m => m.HistoryUserComponent)
  },
  {
    path: 'actividades',
    loadComponent: () =>
      import('./pages/actividades/actividades.component').then(m => m.ActividadesComponent)
  },
  {
    path: 'actividades/:correo',
    loadComponent: () =>
      import('./pages/actividades/actividades.component').then(m => m.ActividadesComponent)
  }
];
