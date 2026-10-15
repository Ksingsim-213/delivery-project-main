import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'dashboard',
  },
  {
    path: 'dashboard',
    loadComponent: () =>
      import('./pages/dashboard/dashboard').then((page) => page.Dashboard),
  },
  {
    path: 'customers',
    loadComponent: () =>
      import('./pages/customers/customers').then((page) => page.Customers),
  },
  {
    path: 'orders',
    loadComponent: () => import('./pages/orders/orders').then((page) => page.Orders),
  },
  {
    path: 'routes',
    loadComponent: () => import('./pages/routes/routes').then((page) => page.Routes),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
