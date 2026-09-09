import { Injectable } from '@angular/core';
import { User } from '../models/user.model';

type LocalAccount = {
  email: string;
  password: string;
  username: string;
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  public userInfo?: User;

  private readonly accountsKey = 'channel_accounts';
  private readonly currentUserKey = 'channel_current_user';

  constructor() {
    this.restoreUser();
  }

  private getAccounts(): LocalAccount[] {
    try {
      const data = localStorage.getItem(this.accountsKey);

      if (!data) {
        return [];
      }

      const accounts = JSON.parse(data);

      return Array.isArray(accounts)
        ? accounts
        : [];

    } catch {
      return [];
    }
  }

  private saveAccounts(accounts: LocalAccount[]) {
    localStorage.setItem(
      this.accountsKey,
      JSON.stringify(accounts)
    );
  }

  private restoreUser() {

    try {

      const data =
        localStorage.getItem(
          this.currentUserKey
        );

      if (!data) {
        return;
      }

      this.userInfo =
        JSON.parse(data);

    } catch {

      this.userInfo = undefined;

    }
  }

  async register(
    email: string,
    password: string,
    username: string
  ) {

    email = email.trim().toLowerCase();
    username = username.trim();

    if (!email) {
      return {
        success: false,
        message: 'יש להזין כתובת אימייל.'
      };
    }

    if (!username) {
      return {
        success: false,
        message: 'יש להזין שם משתמש.'
      };
    }

    if (password.length < 6) {
      return {
        success: false,
        message: 'הסיסמה חייבת להכיל לפחות 6 תווים.'
      };
    }

    const accounts =
      this.getAccounts();

    const exists =
      accounts.some(
        account =>
          account.email === email
      );

    if (exists) {

      return {
        success: false,
        message:
          'כבר קיים משתמש עם כתובת האימייל הזו.'
      };

    }

    const account: LocalAccount = {
      email,
      password,
      username
    };

    accounts.push(account);

    this.saveAccounts(accounts);

    const user = {
      email,
      username
    } as User;

    this.userInfo = user;

    localStorage.setItem(
      this.currentUserKey,
      JSON.stringify(user)
    );

    return {
      success: true
    };
  }

  async loginWithPassword(
    email: string,
    password: string
  ) {

    email = email.trim().toLowerCase();

    const accounts =
      this.getAccounts();

    const account =
      accounts.find(
        item =>
          item.email === email &&
          item.password === password
      );

    if (!account) {

      return {
        success: false,
        status: 'failed'
      };
    }

    const user = {
      email: account.email,
      username: account.username
    } as User;

    this.userInfo = user;

    localStorage.setItem(
      this.currentUserKey,
      JSON.stringify(user)
    );

    return {
      success: true,
      status: 'approved'
    };
  }

  async loginWithGoogle() {

    return {
      success: false,
      status: 'disabled'
    };
  }

  async login(code: string) {

    return false;
  }

  async logout() {

    this.userInfo = undefined;

    localStorage.removeItem(
      this.currentUserKey
    );

    return true;
  }

  async loadUserInfo(): Promise<User | undefined> {

    this.restoreUser();

    return this.userInfo;
  }
}
