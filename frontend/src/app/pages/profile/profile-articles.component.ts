import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, combineLatest, EMPTY, Observable, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../core/api.service';
import { ArticleService } from '../../core/article.service';
import { AuthService } from '../../core/auth.service';
import { Article } from '../../core/models';
import { ArticleListComponent } from '../../shared/article-list.component';

@Component({
  selector: 'app-profile-articles',
  imports: [ArticleListComponent],
  templateUrl: './profile-articles.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileArticlesComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly articleApi = inject(ArticleService);

  /** Live API state — the server applies the author/favorited filter. */
  readonly articles = signal<Article[]>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly data = toSignal(this.route.data, {
    initialValue: this.route.snapshot.data,
  });
  private readonly parentParams = toSignal(this.route.parent!.paramMap, {
    initialValue: this.route.parent!.snapshot.paramMap,
  });

  readonly mode = computed<'authored' | 'favorites'>(
    () => (this.data()['mode'] as 'authored' | 'favorites') ?? 'authored',
  );
  readonly username = computed(() => this.parentParams().get('username') ?? '');

  readonly visible = computed<Article[]>(() => this.articles());

  readonly emptyMessage = computed(() =>
    this.mode() === 'favorites'
      ? 'No favorited articles yet.'
      : 'This author has not published anything yet.',
  );

  constructor() {
    // Refetch when either the tab (route data) or the profile handle changes.
    combineLatest([this.route.parent!.paramMap, this.route.data])
      .pipe(
        switchMap(([params, data]) =>
          this.load(
            params.get('username') ?? '',
            (data['mode'] as 'authored' | 'favorites') ?? 'authored',
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  private load(username: string, mode: 'authored' | 'favorites'): Observable<unknown> {
    this.loading.set(true);
    this.error.set(null);

    const query = mode === 'favorites' ? { favorited: username } : { author: username };

    return this.articleApi.list(query).pipe(
      tap((res) => {
        this.articles.set(res.articles);
        this.loading.set(false);
      }),
      catchError((err: unknown) => {
        this.articles.set([]);
        this.error.set(apiErrorMessage(err, 'Could not load these articles.'));
        this.loading.set(false);
        return EMPTY;
      }),
    );
  }

  toggleFavorite(target: Article): void {
    if (!this.auth.isAuthenticated()) {
      void this.router.navigate(['/login'], { queryParams: { redirect: this.router.url } });
      return;
    }
    this.articleApi.setFavorite(target.slug, !target.favorited).subscribe({
      next: (updated) => {
        // On the "Favorited Articles" tab, un-favoriting removes the row.
        if (this.mode() === 'favorites' && !updated.favorited) {
          this.articles.update((list) => list.filter((a) => a.slug !== updated.slug));
          return;
        }
        this.articles.update((list) =>
          list.map((a) => (a.slug === updated.slug ? updated : a)),
        );
      },
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Could not update your favorite.')),
    });
  }
}
