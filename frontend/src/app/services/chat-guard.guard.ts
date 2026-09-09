import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const AuthGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  try {
    const userInfo = await authService.loadUserInfo();

    if (userInfo) {
      return true;
    }

    return router.createUrlTree(['/login']);

  } catch (err: any) {
    authService.userInfo = undefined;
    return router.createUrlTree(['/login']);
  }
};
