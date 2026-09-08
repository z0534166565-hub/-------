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

  checkUserInfo = false;

  status:
    | 'failed'
    | 'pending'
    | 'approved'
    | undefined;

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

      this._route.queryParams.subscribe(
        params => {

          if (
            !params['code']
          ) {
            return;
          }

          const savedState =
            localStorage.getItem(
              'google_oauth_state'
            );

          if (
            params['state'] !== savedState
          ) {
            return;
          }

          this.code =
            params['code'];

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

            });
        }
      );

    } finally {

      this.checkUserInfo = false;

    }
  }

  login() {

    this.status =
      undefined;

    this._authService
      .loginWithGoogle()

      .catch(() => {

        this.status =
          'failed';

      });
  }
}
