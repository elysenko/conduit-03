import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, ParamMap, Router } from '@angular/router';
import { catchError, EMPTY, Observable, switchMap, tap } from 'rxjs';
import { apiErrorMessage } from '../../core/api.service';
import { ArticleService } from '../../core/article.service';
import { AuthService } from '../../core/auth.service';
import { Article, ListArticlesQuery } from '../../core/models';
import { TagService } from '../../core/tag.service';
import { ArticleListComponent } from '../../shared/article-list.component';
import { TagListComponent } from '../../shared/tag-list.component';

const PAGE_SIZE = 5;

@Component({
  selector: 'app-home',
  imports: [ArticleListComponent, TagListComponent],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class HomeComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly auth = inject(AuthService);
  private readonly articleApi = inject(ArticleService);
  private readonly tagApi = inject(TagService);

  readonly isAuthenticated = this.auth.isAuthenticated;

  /** Live API state. Filtering and paging are server-side, so what is fetched
   *  is exactly what is rendered. */
  readonly articles = signal<Article[]>([]);
  readonly tags = signal<string[]>([]);

  readonly loading = signal(true);
  readonly tagsLoading = signal(true);
  readonly error = signal<string | null>(null);

  private readonly params = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly activeTag = computed(() => this.params().get('tag'));
  readonly page = computed(() => Math.max(1, Number(this.params().get('page') ?? 1) || 1));
  readonly tab = computed(() => {
    const requested = this.params().get('tab');
    if (this.activeTag()) {
      return 'tag';
    }
    return requested === 'feed' && this.isAuthenticated() ? 'feed' : 'global';
  });

  readonly pageSize = PAGE_SIZE;

  /** Server-reported total, so the pager spans every page and not just this one. */
  readonly visibleCount = signal(0);
  readonly visible = computed(() => this.articles());

  readonly emptyMessage = computed(() =>
    this.tab() === 'feed'
      ? 'Your feed is empty — follow an author to see their articles here.'
      : 'No articles are here… yet.',
  );

  constructor() {
    // Every query-param change (tab, tag, page) refetches; switchMap drops the
    // response of a filter the user has already navigated away from.
    this.route.queryParamMap
      .pipe(
        switchMap((params) => this.fetch(params)),
        takeUntilDestroyed(),
      )
      .subscribe();

    this.tagApi
      .popular()
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: (tags) => {
          this.tags.set(tags);
          this.tagsLoading.set(false);
        },
        // The sidebar is supporting content: on failure it shows its empty
        // state rather than taking over the page with an error.
        error: () => {
          this.tags.set([]);
          this.tagsLoading.set(false);
        },
      });
  }

  private fetch(params: ParamMap): Observable<unknown> {
    const tag = params.get('tag');
    const page = Math.max(1, Number(params.get('page') ?? 1) || 1);
    const wantsFeed = params.get('tab') === 'feed' && this.isAuthenticated();

    const query: ListArticlesQuery = {
      limit: PAGE_SIZE,
      offset: (page - 1) * PAGE_SIZE,
    };
    if (tag) {
      query.tag = tag;
    }

    this.loading.set(true);
    this.error.set(null);

    // A tag filter is a global-feed concern, so it wins over the feed tab.
    const request = wantsFeed && !tag ? this.articleApi.feed(query) : this.articleApi.list(query);

    return request.pipe(
      tap((res) => {
        this.articles.set(res.articles);
        this.visibleCount.set(res.articlesCount);
        this.loading.set(false);
      }),
      catchError((err: unknown) => {
        this.articles.set([]);
        this.visibleCount.set(0);
        this.error.set(apiErrorMessage(err, 'Could not load articles. Please try again.'));
        this.loading.set(false);
        return EMPTY;
      }),
    );
  }

  selectTab(tab: 'global' | 'feed'): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab, tag: null, page: null },
    });
  }

  selectTag(tag: string): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tag, tab: null, page: null },
    });
  }

  changePage(page: number): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { page },
      queryParamsHandling: 'merge',
    });
  }

  /** Favoriting is a write: anonymous readers are sent to sign in first. */
  toggleFavorite(target: Article): void {
    if (!this.isAuthenticated()) {
      void this.router.navigate(['/login'], { queryParams: { redirect: this.router.url } });
      return;
    }
    this.articleApi.setFavorite(target.slug, !target.favorited).subscribe({
      next: (updated) =>
        this.articles.update((list) =>
          list.map((a) => (a.slug === updated.slug ? updated : a)),
        ),
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Could not update your favorite. Please try again.')),
    });
  }
}
