import { HttpClient, HttpErrorResponse, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

/**
 * Same-origin API root, resolved against the document's `<base href>`.
 *
 * nginx proxies `/api/` to the NestJS service in both Docker and Kubernetes and
 * `ng serve` proxies it via proxy.conf.json, so the browser never needs a
 * build-time host and no CORS preflight is involved. Resolving against the base
 * rather than hard-coding a leading "/api" keeps the app correct when it is
 * served from a sub-path: preview hosts put many apps on one origin under
 * `/<id>/`, where an absolute "/api" would escape this app and hit a neighbour.
 */
function resolveApiBase(): string {
  if (typeof document === 'undefined') {
    return '/api';
  }
  try {
    // base "/" -> "/api"; base "/<id>/" -> "/<id>/api".
    return new URL('api', document.baseURI).pathname.replace(/\/$/, '');
  } catch {
    return '/api';
  }
}

export const API_BASE = resolveApiBase();

export type QueryValue = string | number | boolean | null | undefined;

function toParams(query?: Record<string, QueryValue>): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query ?? {})) {
    // Skip empties so `?tag=` never reaches the API as a filter on "".
    if (value !== null && value !== undefined && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

/** Thin, typed transport. Domain services own the shapes; this owns the wire. */
@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly http = inject(HttpClient);

  get<T>(path: string, query?: Record<string, QueryValue>): Observable<T> {
    return this.http.get<T>(`${API_BASE}${path}`, { params: toParams(query) });
  }

  post<T>(path: string, body?: unknown): Observable<T> {
    return this.http.post<T>(`${API_BASE}${path}`, body ?? {});
  }

  put<T>(path: string, body?: unknown): Observable<T> {
    return this.http.put<T>(`${API_BASE}${path}`, body ?? {});
  }

  patch<T>(path: string, body?: unknown): Observable<T> {
    return this.http.patch<T>(`${API_BASE}${path}`, body ?? {});
  }

  delete<T>(path: string): Observable<T> {
    return this.http.delete<T>(`${API_BASE}${path}`);
  }
}

/**
 * NestJS renders failures as `{ statusCode, error, message: string | string[] }`.
 * ValidationPipe uses the array form, which is what the auth/editor forms list.
 */
function bodyMessages(error: HttpErrorResponse): string[] {
  const body = error.error as { message?: unknown } | null;
  const message = body?.message;
  if (Array.isArray(message)) {
    return message.filter((m): m is string => typeof m === 'string');
  }
  return typeof message === 'string' && message.trim() ? [message] : [];
}

/** Field-level messages for form screens; falls back to one status-derived line. */
export function apiErrorMessages(error: unknown, fallback: string): string[] {
  if (!(error instanceof HttpErrorResponse)) {
    return [fallback];
  }
  const messages = bodyMessages(error);
  return messages.length ? messages : [apiErrorMessage(error, fallback)];
}

/** A single sentence for banner/inline error states. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof HttpErrorResponse)) {
    return fallback;
  }
  if (error.status === 0) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  const [first] = bodyMessages(error);
  return first ?? fallback;
}

/** True when the article/profile/comment simply is not there. */
export function isNotFound(error: unknown): boolean {
  return error instanceof HttpErrorResponse && error.status === 404;
}
