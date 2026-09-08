import { HttpInterceptorFn } from '@angular/common/http';
import { readRaw } from './storage';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const token = readRaw('token');
  if (!token) {
    return next(req);
  }
  return next(
    req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }),
  );
};
