import { HttpInterceptorFn } from '@angular/common/http';

export const apiInterceptor: HttpInterceptorFn = (req, next) => {
  // האתר רץ כולו על GitHub Pages.
  // אין יותר הפניה לשרת Render.

  return next(req);
};
