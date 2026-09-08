import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { toSignal } from '@angular/core/rxjs-interop';
import { AuthService } from '../../core/auth.service';
import { MOCK_ARTICLES, MOCK_TAGS } from '../../core/mock-data';
import { Article } from '../../core/models';
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

  readonly isAuthenticated = this.auth.isAuthenticated;

  /** Backend-owned data — replaced with API calls by the service layer. */
  articles = signal<Article[]>([...MOCK_ARTICLES]);
  tags = signal<string[]>([...MOCK_TAGS]);

  loading = signal(false);
  tagsLoading = signal(false);
  error = signal<string | null>(null);

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

  private readonly filtered = computed<Article[]>(() => {
    const tag = this.activeTag();
    const all = this.articles();
    if (tag) {
      return all.filter((a) => a.tagList.includes(tag));
    }
    if (this.tab() === 'feed') {
      return all.filter((a) => a.author.following);
    }
    return all;
  });

  readonly visibleCount = computed(() => this.filtered().length);
  readonly visible = computed(() => {
    const start = (this.page() - 1) * PAGE_SIZE;
    return this.filtered().slice(start, start + PAGE_SIZE);
  });

  readonly emptyMessage = computed(() =>
    this.tab() === 'feed'
      ? 'Your feed is empty — follow an author to see their articles here.'
      : 'No articles are here… yet.',
  );

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

  toggleFavorite(target: Article): void {
    this.articles.update((list) =>
      list.map((a) =>
        a.slug === target.slug
          ? {
              ...a,
              favorited: !a.favorited,
              favoritesCount: a.favoritesCount + (a.favorited ? -1 : 1),
            }
          : a,
      ),
    );
  }
}
