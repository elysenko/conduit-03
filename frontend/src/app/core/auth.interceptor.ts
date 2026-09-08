import { HttpInterceptorFn } from '@angular/common/http';
import { API_BASE } from './api.service';
import { readRaw } from './storage';

/**
 * Attaches the bearer token to same-origin API calls only. Scoping it to `/api`
 * keeps the credential off any third-party request the app may make later
 * (avatar hosts, object storage) — a token is only ever sent to our own API.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = readRaw('token');
  if (!token || !req.url.startsWith(API_BASE)) {
    return next(req);
  }
  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
  );
};
