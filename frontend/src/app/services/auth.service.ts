import { Injectable } from '@angular/core';

import { User } from '../models/user.model';

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  public userInfo?: User;

  async loginWithGoogle() {
    return {
      success: false,
      status: 'disabled'
    };
  }

  async login(
    code: string
  ) {
    return false;
  }

  async loginWithPassword(
    email: string,
    password: string
  ) {
    return {
      success: false,
      status: 'disabled'
    };
  }

  async logout() {
    this.userInfo = undefined;
    return true;
  }

  async loadUserInfo() {
    return this.userInfo;
  }
}
