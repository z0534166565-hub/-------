import { Component, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import {
  NbButtonModule,
  NbCardModule
} from '@nebular/theme';

import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-login',
  imports: [
    FormsModule,
    NbButtonModule,
    NbCardModule
  ],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent
  implements OnInit {

  code = '';

  email = '';

  password = '';

  checkUserInfo = false;

  loading = false;

  loginMethod:
    | 'password'
    | 'google' = 'password';

  status:
    | 'failed'
    | 'pending'
    | 'approved'
    | undefined;

  errorMessage = '';

  constructor(
    private _authService: AuthService,
    private _route: ActivatedRoute,
    private router: Router
  ) {}

  async ngOnInit() {

    this.checkUserInfo = true;

    try {

      await this._authService.loadUserInfo();

      if (this._authService.userInfo) {

        await this.router.navigate(['/']);

        return;
      }

    } catch {

      // אין משתמש מחובר.
      // ממשיכים למסך ההתחברות.
    }

    this._route.queryParams.subscribe(
      params => {

        if (!params['code']) {
          this.checkUserInfo = false;
          return;
        }

        const savedState =
          localStorage.getItem(
            'google_oauth_state'
          );

        if (
          params['state'] !== savedState
        ) {

          this.checkUserInfo = false;

          this.status =
            'failed';

          this.errorMessage =
            'אימות Google לא תקין.';

          return;
        }

        this.code =
          params['code'];

        this.loading = true;

        this._authService
          .login(this.code)

          .then(() => {

            this.status =
              'approved';

            localStorage.removeItem(
              'google_oauth_state'
            );

            this.router.navigate(['/']);

          })

          .catch((err: any) => {

            this.code = '';

            localStorage.removeItem(
              'google_oauth_state'
            );

            if (
              err?.status === 403 &&
              err?.error?.status === 'pending'
            ) {

              this.status =
                'pending';

              return;
            }

            this.status =
              'failed';

            this.errorMessage =
              'ההתחברות באמצעות Google נכשלה.';

          })

          .finally(() => {
            this.loading = false;
            this.checkUserInfo = false;
          });
      }
    );

    this.checkUserInfo = false;
  }

  async loginWithPassword() {

    this.status =
      undefined;

    this.errorMessage =
      '';

    const email =
      this.email.trim();

    if (!email) {

      this.status =
        'failed';

      this.errorMessage =
        'יש להזין כתובת אימייל.';

      return;
    }

    if (!this.password) {

      this.status =
        'failed';

      this.errorMessage =
        'יש להזין סיסמה.';

      return;
    }

    if (this.password.length < 6) {

      this.status =
        'failed';

      this.errorMessage =
        'הסיסמה חייבת להכיל לפחות 6 תווים.';

      return;
    }

    this.loading = true;

    try {

      const result =
        await this._authService.loginWithPassword(
          email,
          this.password
        );

      if (
        result.status === 'pending'
      ) {

        this.status =
          'pending';

        return;
      }

      if (
        result.success
      ) {

        this.status =
          'approved';

        await this.router.navigate(['/']);

        return;
      }

      this.status =
        'failed';

      this.errorMessage =
        'ההתחברות נכשלה.';

    } catch (err: any) {

      if (
        err?.status === 403 &&
        err?.error?.status === 'pending'
      ) {

        this.status =
          'pending';

        return;
      }

      if (
        err?.status === 401
      ) {

        this.status =
          'failed';

        this.errorMessage =
          'האימייל או הסיסמה שגויים.';

        return;
      }

      this.status =
        'failed';

      this.errorMessage =
        'לא ניתן להתחבר כרגע. נסה שוב.';
    }

    finally {

      this.loading = false;
    }
  }

  loginWithGoogle() {

    this.status =
      undefined;

    this.errorMessage =
      '';

    this.loading = true;

    this._authService
      .loginWithGoogle()
      .catch(() => {

        this.loading = false;

        this.status =
          'failed';

        this.errorMessage =
          'לא ניתן לפתוח את ההתחברות באמצעות Google.';
      });
  }
}
