import { Routes } from '@angular/router';
import { adminGuard, authGuard } from './core/auth.guard';

export const routes: Routes = [
  {
    path: '',
    title: 'Conduit',
    data: { flow: 'browse' },
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'login',
    title: 'Sign in — Conduit',
    data: { flow: 'auth' },
    loadComponent: () =>
      import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: 'register',
    title: 'Sign up — Conduit',
    data: { flow: 'auth' },
    loadComponent: () =>
      import('./pages/register/register.component').then((m) => m.RegisterComponent),
  },
  {
    path: 'article/:slug',
    title: 'Article — Conduit',
    data: { flow: 'read' },
    loadComponent: () =>
      import('./pages/article/article.component').then((m) => m.ArticleComponent),
  },
  {
    path: 'editor',
    title: 'New Article — Conduit',
    data: { flow: 'publish' },
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/editor/editor.component').then((m) => m.EditorComponent),
  },
  {
    path: 'editor/:slug',
    title: 'Edit Article — Conduit',
    data: { flow: 'publish' },
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/editor/editor.component').then((m) => m.EditorComponent),
  },
  {
    path: 'settings',
    title: 'Your Settings — Conduit',
    data: { flow: 'account' },
    canActivate: [authGuard],
    loadComponent: () =>
      import('./pages/settings/settings.component').then((m) => m.SettingsComponent),
  },
  {
    path: 'admin/settings',
    title: 'Admin Settings — Conduit',
    data: { flow: 'admin' },
    canActivate: [adminGuard],
    loadComponent: () =>
      import('./pages/admin-settings/admin-settings.component').then(
        (m) => m.AdminSettingsComponent,
      ),
  },
  {
    path: 'profile/:username',
    title: 'Profile — Conduit',
    data: { flow: 'browse' },
    loadComponent: () =>
      import('./pages/profile/profile.component').then((m) => m.ProfileComponent),
    children: [
      {
        path: '',
        data: { mode: 'authored' },
        loadComponent: () =>
          import('./pages/profile/profile-articles.component').then(
            (m) => m.ProfileArticlesComponent,
          ),
      },
      {
        path: 'favorites',
        data: { mode: 'favorites' },
        loadComponent: () =>
          import('./pages/profile/profile-articles.component').then(
            (m) => m.ProfileArticlesComponent,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
