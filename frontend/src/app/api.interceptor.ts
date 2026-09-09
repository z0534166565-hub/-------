import { HttpInterceptorFn } from '@angular/common/http';

const API_URL = 'https://updates-from-the-house-of-elders.onrender.com';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  // רק בקשות פנימיות ל־API/Auth
  if (
    req.url.startsWith('/api/') ||
    req.url.startsWith('/auth/') ||
    req.url.startsWith('/import/')
  ) {
    const apiReq = req.clone({
      url: API_URL + req.url
    });

    return next(apiReq);
  }

  return next(req);
};
