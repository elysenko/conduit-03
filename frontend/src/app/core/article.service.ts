import { inject, Injectable } from '@angular/core';
import { map, Observable } from 'rxjs';
import { ApiService } from './api.service';
import { withAvatar } from './avatar';
import { Article, ArticleListResponse, ListArticlesQuery } from './models';

export interface ArticleInput {
  title: string;
  description: string;
  body: string;
  tagList: string[];
}

/** Server envelopes: `{ article }` for one, `{ articles, articlesCount }` for many. */
interface ArticleEnvelope {
  article: Article;
}

function normalize(article: Article): Article {
  return { ...article, author: withAvatar(article.author) };
}

function normalizeList(response: ArticleListResponse): ArticleListResponse {
  return {
    articles: response.articles.map(normalize),
    articlesCount: response.articlesCount,
  };
}

/** Articles, favorites and the personalised feed — GET /api/articles and friends. */
@Injectable({ providedIn: 'root' })
export class ArticleService {
  private readonly api = inject(ApiService);

  /** Global feed with optional tag/author/favorited filters and pagination. */
  list(query: ListArticlesQuery = {}): Observable<ArticleListResponse> {
    return this.api
      .get<ArticleListResponse>('/articles', { ...query })
      .pipe(map(normalizeList));
  }

  /** Articles by the authors the signed-in user follows. Requires a token. */
  feed(query: ListArticlesQuery = {}): Observable<ArticleListResponse> {
    return this.api
      .get<ArticleListResponse>('/articles/feed', { ...query })
      .pipe(map(normalizeList));
  }

  get(slug: string): Observable<Article> {
    return this.api.get<ArticleEnvelope>(`/articles/${encodeURIComponent(slug)}`).pipe(
      map((res) => normalize(res.article)),
    );
  }

  create(input: ArticleInput): Observable<Article> {
    return this.api
      .post<ArticleEnvelope>('/articles', { article: input })
      .pipe(map((res) => normalize(res.article)));
  }

  /** The response owns the slug: editing the title regenerates it server-side. */
  update(slug: string, input: ArticleInput): Observable<Article> {
    return this.api
      .put<ArticleEnvelope>(`/articles/${encodeURIComponent(slug)}`, { article: input })
      .pipe(map((res) => normalize(res.article)));
  }

  remove(slug: string): Observable<void> {
    return this.api
      .delete<{ slug: string }>(`/articles/${encodeURIComponent(slug)}`)
      .pipe(map(() => undefined));
  }

  /** POST adds the favorite, DELETE removes it; both answer with the fresh article. */
  setFavorite(slug: string, favorited: boolean): Observable<Article> {
    const path = `/articles/${encodeURIComponent(slug)}/favorite`;
    const request = favorited
      ? this.api.post<ArticleEnvelope>(path)
      : this.api.delete<ArticleEnvelope>(path);
    return request.pipe(map((res) => normalize(res.article)));
  }
}
