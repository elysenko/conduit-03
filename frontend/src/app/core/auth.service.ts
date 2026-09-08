import { HttpClient } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { Router } from '@angular/router';
import { map, Observable, of, tap, throwError } from 'rxjs';
import { DEMO_USER } from './mock-data';
import { Role, User } from './models';
import { readRaw, removeKeys, writeRaw } from './storage';

const USER_KEY = 'user';
const TOKEN_KEY = 'token';
const ANON_KEY = 'anon';

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

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);

  readonly currentUser = signal<User | null>(null);
  readonly isAuthenticated = computed(() => this.currentUser() !== null);
  readonly isAdmin = computed(() => this.currentUser()?.role === 'ADMIN');

  /** Preview-only shortcut label; kept out of the template so it cannot ship. */
  readonly previewShortcut = COLOSSUS_PREVIEW ? 'Skip login — Demo Mode' : '';

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
      removeKeys(USER_KEY, TOKEN_KEY);
    } catch {
      removeKeys(USER_KEY, TOKEN_KEY);
    }

    if (COLOSSUS_PREVIEW && readRaw(ANON_KEY) !== '1') {
      // Static preview has no API: treat the reviewer as already signed in so
      // every authenticated route renders on a cold, direct URL load.
      this.persist(DEMO_USER);
    }
  }

  private persist(user: User): void {
    this.currentUser.set(user);
    writeRaw(USER_KEY, JSON.stringify(user));
    if (user.token) {
      writeRaw(TOKEN_KEY, user.token);
    } else {
      removeKeys(TOKEN_KEY);
    }
    removeKeys(ANON_KEY);
  }

  login(creds: Credentials, redirect?: string | null): Observable<User> {
    if (COLOSSUS_PREVIEW) {
      const errors = this.validate(creds);
      if (errors.length) {
        return throwError(() => errors);
      }
      const user: User = {
        ...DEMO_USER,
        email: creds.email,
        username: this.deriveUsername(creds.email),
      };
      this.persist(user);
      void this.router.navigateByUrl(redirect || '/');
      return of(user);
    }

    return this.http
      .post<{ user: User }>('/api/users/login', { user: creds })
      .pipe(
        map((res) => res.user),
        tap((user) => {
          this.persist(user);
          void this.router.navigateByUrl(redirect || '/');
        }),
      );
  }

  register(creds: Credentials, redirect?: string | null): Observable<User> {
    if (COLOSSUS_PREVIEW) {
      const errors = this.validate(creds, true);
      if (errors.length) {
        return throwError(() => errors);
      }
      const user: User = {
        ...DEMO_USER,
        id: 'usr_new',
        email: creds.email,
        username: creds.username || this.deriveUsername(creds.email),
        bio: '',
      };
      this.persist(user);
      void this.router.navigateByUrl(redirect || '/');
      return of(user);
    }

    return this.http.post<{ user: User }>('/api/users', { user: creds }).pipe(
      map((res) => res.user),
      tap((user) => {
        this.persist(user);
        void this.router.navigateByUrl(redirect || '/');
      }),
    );
  }

  updateUser(patch: Partial<User>): Observable<User> {
    const merged = { ...(this.currentUser() ?? DEMO_USER), ...patch } as User;
    if (COLOSSUS_PREVIEW) {
      this.persist(merged);
      return of(merged);
    }
    return this.http.put<{ user: User }>('/api/user', { user: patch }).pipe(
      map((res) => res.user),
      tap((user) => this.persist(user)),
    );
  }

  logout(): void {
    this.currentUser.set(null);
    removeKeys(USER_KEY, TOKEN_KEY);
    writeRaw(ANON_KEY, '1');
    void this.router.navigateByUrl('/');
  }

  /** Preview-only: seed the signed-in state with no credentials at all. */
  previewSignIn(): void {
    if (!COLOSSUS_PREVIEW) {
      return;
    }
    this.persist(DEMO_USER);
    void this.router.navigateByUrl('/');
  }

  hasRole(role: Role): boolean {
    return this.currentUser()?.role === role;
  }

  private deriveUsername(email: string): string {
    return (email.split('@')[0] || 'reader').replace(/[^a-z0-9-]/gi, '') || 'reader';
  }

  private validate(creds: Credentials, requireUsername = false): string[] {
    const errors: string[] = [];
    if (requireUsername && !creds.username?.trim()) {
      errors.push("username can't be blank");
    }
    if (!creds.email?.trim()) {
      errors.push("email can't be blank");
    } else if (!/^[^\s@]+@[^\s@]+$/.test(creds.email.trim())) {
      errors.push('email must be a valid address');
    }
    if (!creds.password) {
      errors.push("password can't be blank");
    } else if (creds.password.length < 8) {
      errors.push('password must be at least 8 characters');
    }
    return errors;
  }
}
