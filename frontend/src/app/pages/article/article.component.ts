import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, EMPTY, forkJoin, Observable, of, switchMap, tap } from 'rxjs';
import { apiErrorMessage, isNotFound } from '../../core/api.service';
import { ArticleService } from '../../core/article.service';
import { AuthService } from '../../core/auth.service';
import { CommentService } from '../../core/comment.service';
import { Article, Comment, Profile } from '../../core/models';
import { ProfileService } from '../../core/profile.service';
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
  private readonly articleApi = inject(ArticleService);
  private readonly commentApi = inject(CommentService);
  private readonly profileApi = inject(ProfileService);

  readonly currentUser = this.auth.currentUser;
  readonly isAuthenticated = this.auth.isAuthenticated;

  /** Live API state — one article and its comments, keyed by the route slug. */
  readonly article = signal<Article | null>(null);
  readonly comments = signal<Comment[]>([]);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly commentForm = this.fb.nonNullable.group({
    body: ['', [Validators.required, Validators.minLength(2)]],
  });

  private readonly query = toSignal(this.route.queryParamMap, {
    initialValue: this.route.snapshot.queryParamMap,
  });

  readonly slug = computed(() => this.article()?.slug ?? '');

  readonly isAuthor = computed(
    () => this.article()?.author.username === this.currentUser()?.username,
  );
  readonly bodyParagraphs = computed(() =>
    (this.article()?.body ?? '').split('\n').filter((line) => line.trim().length),
  );

  readonly modal = computed(() => this.query().get('modal'));
  readonly pendingCommentId = computed(() => this.query().get('commentId'));

  constructor() {
    this.route.paramMap
      .pipe(
        switchMap((params) => this.load(params.get('slug') ?? '')),
        takeUntilDestroyed(),
      )
      .subscribe();
  }

  private load(slug: string): Observable<unknown> {
    this.loading.set(true);
    this.error.set(null);

    return forkJoin({
      article: this.articleApi.get(slug),
      // Comments are secondary: a failure there must not hide the article.
      comments: this.commentApi.list(slug).pipe(catchError(() => of([] as Comment[]))),
    }).pipe(
      tap(({ article, comments }) => {
        this.article.set(article);
        this.comments.set(comments);
        this.loading.set(false);
      }),
      catchError((err: unknown) => {
        this.article.set(null);
        this.comments.set([]);
        // A 404 is not an error banner — the template has a "not found" state.
        this.error.set(
          isNotFound(err) ? null : apiErrorMessage(err, 'Could not load this article.'),
        );
        this.loading.set(false);
        return EMPTY;
      }),
    );
  }

  canDeleteComment(comment: Comment): boolean {
    return comment.author.username === this.currentUser()?.username;
  }

  /** Anonymous readers are sent to sign in before any write. */
  private requireAuth(): boolean {
    if (this.isAuthenticated()) {
      return true;
    }
    void this.router.navigate(['/login'], { queryParams: { redirect: this.router.url } });
    return false;
  }

  toggleFavorite(): void {
    const current = this.article();
    if (!current || !this.requireAuth()) {
      return;
    }
    this.articleApi.setFavorite(current.slug, !current.favorited).subscribe({
      next: (updated) => this.article.set(updated),
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, 'Could not update your favorite.')),
    });
  }

  toggleFollow(): void {
    const current = this.article();
    if (!current || !this.requireAuth()) {
      return;
    }
    const author = current.author;
    this.profileApi.setFollow(author.username, !author.following).subscribe({
      next: (profile: Profile) =>
        this.article.update((a) => (a ? { ...a, author: profile } : a)),
      error: (err: unknown) =>
        this.error.set(apiErrorMessage(err, `Could not follow ${author.username}.`)),
    });
  }

  addComment(): void {
    const current = this.article();
    if (!current || this.commentForm.invalid) {
      this.commentForm.markAllAsTouched();
      return;
    }
    const body = this.commentForm.getRawValue().body;
    this.commentApi
      .create(current.slug, body)
      .subscribe({
        next: (comment) => {
          this.comments.update((list) => [comment, ...list]);
          this.commentForm.reset({ body: '' });
        },
        error: (err: unknown) =>
          this.error.set(apiErrorMessage(err, 'Could not post your comment.')),
      });
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
    const current = this.article();
    if (!current) {
      return;
    }
    this.articleApi.remove(current.slug).subscribe({
      next: () => void this.router.navigate(['/']),
      error: (err: unknown) => {
        this.closeModal();
        this.error.set(apiErrorMessage(err, 'Could not delete this article.'));
      },
    });
  }

  confirmDeleteComment(): void {
    const current = this.article();
    const id = this.pendingCommentId();
    if (!current || !id) {
      this.closeModal();
      return;
    }
    this.commentApi.remove(current.slug, id).subscribe({
      next: () => {
        this.comments.update((list) => list.filter((c) => c.id !== id));
        this.closeModal();
      },
      error: (err: unknown) => {
        this.closeModal();
        this.error.set(apiErrorMessage(err, 'Could not delete this comment.'));
      },
    });
  }
}
