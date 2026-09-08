import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute } from '@angular/router';
import { MOCK_ARTICLES } from '../../core/mock-data';
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

  /** Backend-owned data — replaced with API calls by the service layer. */
  articles = signal<Article[]>([...MOCK_ARTICLES]);

  loading = signal(false);
  error = signal<string | null>(null);

  private readonly data = toSignal(this.route.data, {
    initialValue: this.route.snapshot.data,
  });
  private readonly parentParams = toSignal(
    this.route.parent!.paramMap,
    { initialValue: this.route.parent!.snapshot.paramMap },
  );

  readonly mode = computed<'authored' | 'favorites'>(
    () => (this.data()['mode'] as 'authored' | 'favorites') ?? 'authored',
  );
  readonly username = computed(() => this.parentParams().get('username') ?? '');

  readonly visible = computed<Article[]>(() => {
    const name = this.username();
    return this.mode() === 'favorites'
      ? this.articles().filter((a) => a.favorited)
      : this.articles().filter((a) => a.author.username === name);
  });

  readonly emptyMessage = computed(() =>
    this.mode() === 'favorites'
      ? 'No favorited articles yet.'
      : 'This author has not published anything yet.',
  );

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
