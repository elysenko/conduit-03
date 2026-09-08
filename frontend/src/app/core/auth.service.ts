import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, map, Observable, of, tap } from 'rxjs';
import { ApiService } from './api.service';
import { Role, User } from './models';
import { readRaw, removeKeys, writeRaw } from './storage';

const USER_KEY = 'user';
const TOKEN_KEY = 'token';

export interface Credentials {
  email: string;
  password: string;
  username?: string;
}

function isUser(value: unknown): value is User {
  const u = value as Partial<User> | null;
  return (
    !!u &&
    typeof u === 'object' &&
    typeof u.id === 'string' &&
    typeof u.email === 'string' &&
    typeof u.username === 'string' &&
    typeof u.role === 'string'
  );
}

/**
 * Session state for the SPA. The token is minted by POST /api/users(/login),
 * kept in namespaced localStorage, and replayed on same-origin API calls by
 * `authInterceptor`.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);

  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');

  constructor() {
    this.restore();
  }

  /**
   * Restore the session defensively: anything in storage is untrusted, so a
   * parse failure or unrecognised shape clears the keys and continues rather
   * than throwing (a throw here blanks the whole page).
   */
  private restore(): void {
    try {
      const raw = readRaw(USER_KEY);
      if (raw) {
        const parsed: unknown = JSON.parse(raw);
        if (isUser(parsed)) {
          this.currentUser.set(parsed);
          return;
        }
      }
    } catch {
      /* fall through to the clear below */
    }
    removeKeys(USER_KEY, TOKEN_KEY);
  }

  private persist(user: User): void {
    this.currentUser.set(user);
    writeRaw(USER_KEY, JSON.stringify(user));
    if (user.token) {
      writeRaw(TOKEN_KEY, user.token);
    } else {
      removeKeys(TOKEN_KEY);
    }
  }

  login(creds: Credentials, redirect?: string | null): Observable<User> {
    return this.api
      .post<{ user: User }>('/users/login', { user: creds })
      .pipe(
        map((res) => res.user),
        tap((user) => {
          this.persist(user);
          void this.router.navigateByUrl(redirect || '/');
        }),
      );
  }

  register(creds: Credentials, redirect?: string | null): Observable<User> {
    return this.api.post<{ user: User }>('/users', { user: creds }).pipe(
      map((res) => res.user),
      tap((user) => {
        this.persist(user);
        void this.router.navigateByUrl(redirect || '/');
      }),
    );
  }

  updateUser(patch: Partial<User>): Observable<User> {
    return this.api.put<{ user: User }>('/user', { user: patch }).pipe(
      map((res) => res.user),
      tap((user) => this.persist(user)),
    );
  }

  /**
   * Re-read the signed-in user from the API so a screen never edits a stale
   * copy of the profile. The response carries a freshly signed token, so this
   * also slides the session forward. A failure is non-fatal: the cached user
   * stays in place and the caller keeps rendering.
   */
  refreshCurrentUser(): Observable<User | null> {
    if (!this.currentUser()) {
      return of(null);
    }
    return this.api.get<{ user: User }>('/user').pipe(
      map((res) => res.user),
      tap((user) => this.persist(user)),
      catchError(() => of(this.currentUser())),
    );
  }

  logout(): void {
    this.currentUser.set(null);
    removeKeys(USER_KEY, TOKEN_KEY);
    void this.router.navigateByUrl('/');
  }

  hasRole(role: Role): boolean {
    return this.currentUser()?.role === role;
  }
}
