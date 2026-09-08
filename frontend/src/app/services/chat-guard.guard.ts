import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from './auth.service';

export const AuthGuard: CanActivateFn = async () => {

  const router = inject(Router);
  const authService = inject(AuthService);

  try {

    const userInfo =
      await authService.loadUserInfo();

    if (userInfo) {
      return true;
    }

  } catch (err: any) {

    authService.userInfo = undefined;

    if (
      err?.status === 401 ||
      err?.status === 403
    ) {

      await router.navigate(['/login']);

      return false;
    }

    await router.navigate(['/login']);

    return false;
  }

  await router.navigate(['/login']);

  return false;
};
