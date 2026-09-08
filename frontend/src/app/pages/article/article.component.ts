import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth.service';
import { MOCK_ARTICLES, MOCK_COMMENTS } from '../../core/mock-data';
import { Article, Comment } from '../../core/models';
import { CommentCardComponent } from '../../shared/comment-card.component';
import { ConfirmModalComponent } from '../../shared/confirm-modal.component';

@Component({
  selector: 'app-article',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    RouterLink,
    CommentCardComponent,
    ConfirmModalComponent,
  ],
  templateUrl: './article.component.html',
  styleUrl: './article.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ArticleComponent {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly fb = inject(FormBuilder);
  private readonly auth = inject(AuthService);

  readonly currentUser = this.auth.currentUser;
  readonly isAuthenticated = this.auth.isAuthenticated;

  /** Backend-owned data — replaced with API calls by the service layer. */
  articles = signal<Article[]>([...MOCK_ARTICLES]);
  comments = signal<Comment[]>([...MOCK_COMMENTS]);

  loading = signal(false);
  error = signal<string | null>(null);

  readonly commentForm = this.fb.nonNullable.group({
    body: ['', [Validators.required, Validators.minLength(2)]],
  });

  private readonly params = toSignal(this.route.paramMap, {
    initialValue: this.route.snapshot.paramMap,
  });
  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly slug = computed(() => this.params().get('slug') ?? '');
  readonly article = computed<Article | undefined>(() => {
    const slug = this.slug();
    return this.articles().find((a) => a.slug === slug) ?? this.articles()[0];
  });

  readonly isAuthor = computed(
    () => this.article()?.author.username === this.currentUser()?.username,
  );
  readonly bodyParagraphs = computed(() =>
    (this.article()?.body ?? '').split('\n').filter((line) => line.trim().length),
  );

  readonly modal = computed(() => this.query().get('modal'));
  readonly pendingCommentId = computed(() => this.query().get('commentId'));

  canDeleteComment(comment: Comment): boolean {
    return comment.author.username === this.currentUser()?.username;
  }

  toggleFavorite(): void {
    const slug = this.article()?.slug;
    this.articles.update((list) =>
      list.map((a) =>
        a.slug === slug
          ? {
              ...a,
              favorited: !a.favorited,
              favoritesCount: a.favoritesCount + (a.favorited ? -1 : 1),
            }
          : a,
      ),
    );
  }

  toggleFollow(): void {
    const author = this.article()?.author.username;
    this.articles.update((list) =>
      list.map((a) =>
        a.author.username === author
          ? { ...a, author: { ...a.author, following: !a.author.following } }
          : a,
      ),
    );
  }

  addComment(): void {
    if (this.commentForm.invalid) {
      this.commentForm.markAllAsTouched();
      return;
    }
    const user = this.currentUser();
    const entry: Comment = {
      id: `cmt_${this.comments().length + 1}_local`,
      body: this.commentForm.getRawValue().body,
      createdAt: new Date().toISOString(),
      author: {
        username: user?.username ?? 'you',
        bio: user?.bio ?? '',
        image: user?.image ?? null,
        following: false,
      },
    };
    this.comments.update((list) => [entry, ...list]);
    this.commentForm.reset({ body: '' });
  }

  openDeleteArticle(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { modal: 'delete-article' },
    });
  }

  openDeleteComment(comment: Comment): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { modal: 'delete-comment', commentId: comment.id },
    });
  }

  closeModal(): void {
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { modal: null, commentId: null },
    });
  }

  confirmDeleteArticle(): void {
    const slug = this.article()?.slug;
    this.articles.update((list) => list.filter((a) => a.slug !== slug));
    void this.router.navigate(['/']);
  }

  confirmDeleteComment(): void {
    const id = this.pendingCommentId();
    this.comments.update((list) => list.filter((c) => c.id !== id));
    this.closeModal();
  }
}
