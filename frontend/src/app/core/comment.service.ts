import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiService } from './api.service';
import { withAvatar } from './avatar';
import { Comment } from './models';

/** Comments are nested under their article: /api/articles/:slug/comments. */
@Injectable({ providedIn: 'root' })
export class CommentService {
  private readonly api = inject(ApiService);

  private path(slug: string): string {
    return `/articles/${encodeURIComponent(slug)}/comments`;
  }

  list(slug: string): Observable<Comment[]> {
    return this.api
      .get<{ comments: Comment[] }>(this.path(slug))
      .pipe(map((res) => res.comments.map((c) => ({ ...c, author: withAvatar(c.author) }))));
  }

  create(slug: string, body: string): Observable<Comment> {
    return this.api
      .post<{ comment: Comment }>(this.path(slug), { comment: { body } })
      .pipe(map((res) => ({ ...res.comment, author: withAvatar(res.comment.author) })));
  }

  remove(slug: string, id: string): Observable<void> {
    return this.api
      .delete<{ id: string }>(`${this.path(slug)}/${encodeURIComponent(id)}`)
      .pipe(map(() => undefined));
  }
}
