import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { catchError, EMPTY, Observable, switchMap, tap } from 'rxjs';
import { apiErrorMessage, isNotFound } from '../../core/api.service';
import { AuthService } from '../../core/auth.service';
import { Profile } from '../../core/models';
import { ProfileService } from '../../core/profile.service';

@Component({
  selector: 'app-profile',
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly profileApi = inject(ProfileService);

  /** Live API state — GET /api/profiles/:username. */
  readonly profile = signal<Profile | null>(null);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });

  readonly username = computed(() => this.params().get('username') ?? '');
  readonly isSelf = computed(
    () => this.profile()?.username === this.auth.currentUser()?.username,
  );

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => this.load(params.get('username') ?? '')),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  private load(username: string): Observable<unknown> {
    this.loading.set(true);
    this.error.set(null);

    return this.profileApi.get(username).pipe(
      tap((profile) => {
        this.profile.set(profile);
        this.loading.set(false);
      }),
      catchError((err: unknown) => {
        this.profile.set(null);
        // The template renders its own "not found" state for a missing handle.
        this.error.set(
          isNotFound(err) ? null : apiErrorMessage(err, 'Could not load this profile.'),
        );
        this.loading.set(false);
        return EMPTY;
      }),
    );
  }

  toggleFollow(): void {
    const current = this.profile();
    if (!current) {
      return;
    }
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/login'], { queryParams: { redirect: this.router.url } });
      return;
    }
    this.profileApi.setFollow(current.username, !current.following).subscribe({
      next: (profile) => this.profile.set(profile),
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, `Could not update your follow of ${current.username}.`)),
    });
  }
}
