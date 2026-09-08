import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from './auth.service';

export const AuthGuard: CanActivateFn = async () => {
  const router = inject(Router);
  const authService = inject(AuthService);

  try {
    const userInfo = await authService.loadUserInfo();

    if (!userInfo) {
      router.navigate(['/login']);
      return false;
    }

    if (
      !userInfo.approved &&
      !userInfo.privileges?.['admin']
    ) {
      router.navigate(['/pending']);
      return false;
    }

    return true;

  } catch (err: any) {

    if (err.status === 401) {
      router.navigate(['/login']);
      return false;
    }

    if (err.status === 403) {
      router.navigate(['/pending']);
      return false;
    }

    return false;
  }
};