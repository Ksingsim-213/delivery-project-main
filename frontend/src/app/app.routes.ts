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
    path: 'riders',
    loadComponent: () => import('./pages/riders/riders').then((page) => page.Riders),
  },
  {
    path: 'riders/work/:driverId',
    loadComponent: () =>
      import('./pages/riders/rider-work').then((page) => page.RiderWork),
  },
  {
    path: '**',
    redirectTo: 'dashboard',
  },
];
