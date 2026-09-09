import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';

import { ResponseResult } from '../models/response-result.model';
import { User } from '../models/user.model';

interface GoogleAuthValues {
  googleOauthUrl: string;
  googleOauthScope: string;
  googleClientId: string;
}

interface PasswordLoginResponse {
  success: boolean;
  status?: string;
}

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  public userInfo?: User;

  constructor(
    private _http: HttpClient
  ) {}

  async loginWithGoogle() {

    const googleAuthValues =
      await firstValueFrom(
        this._http.get<GoogleAuthValues>(
          '/auth/google'
        )
      );

    const state =
      crypto.randomUUID();

    const redirectUri =
      window.location.origin +
      '/Updates-from-the-House-of-Elders/login';

    const params =
      new URLSearchParams({
        client_id:
          googleAuthValues.googleClientId,

        redirect_uri:
          redirectUri,

        scope:
          googleAuthValues.googleOauthScope,

        state:
          state,

        response_type:
          'code',

        access_type:
          'offline'
      });

    localStorage.setItem(
      'google_oauth_state',
      state
    );

    window.location.href =
      `${googleAuthValues.googleOauthUrl}?${params.toString()}`;
  }

  async login(
    code: string
  ) {

    try {

      const res =
        await firstValueFrom(
          this._http.post<ResponseResult>(
            '/auth/login',
            {
              code
            }
          )
        );

      return res.success;

    } catch (err) {

      this.userInfo =
        undefined;

      throw err;
    }
  }

  async loginWithPassword(
    email: string,
    password: string
  ) {

    try {

      const res =
        await firstValueFrom(
          this._http.post<PasswordLoginResponse>(
            '/auth/password-login',
            {
              email,
              password
            }
          )
        );

      return res;

    } catch (err) {

      this.userInfo =
        undefined;

      throw err;
    }
  }

  async logout() {

    const res =
      await firstValueFrom(
        this._http.post<ResponseResult>(
          '/auth/logout',
          {}
        )
      );

    if (res.success) {
      this.userInfo =
        undefined;
    }

    return res.success;
  }

  async loadUserInfo() {

    try {

      this.userInfo =
        this.userInfo ||
        await firstValueFrom(
          this._http.get<User>(
            '/api/user-info'
          )
        );

    } catch (err) {

      this.userInfo =
        undefined;

      throw err;
    }

    return this.userInfo;
  }
}
