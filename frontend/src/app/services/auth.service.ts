import { Injectable } from '@angular/core';
import { User } from '../models/user.model';

type LocalAccount = {
  id: string;
  email: string;
  password: string;
  username: string;
  approved: boolean;
  isAdmin: boolean;
  writer: boolean;
  resetRequested: boolean;
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  public userInfo?: User;

  private readonly accountsKey =
    'channel_accounts';

  private readonly currentUserKey =
    'channel_current_user';

  private readonly adminEmail =
    'z0534166565@gmail.com';

  private readonly adminUsername =
    'מנהל';

  private readonly adminPassword =
    '123456';

  constructor() {
    this.ensureAdminAccount();
    this.restoreUser();
  }

  private ensureAdminAccount() {
    const accounts = this.getAccounts();
    const email = this.adminEmail.trim().toLowerCase();

    const existing = accounts.find(
      account => account.email === email
    );

    if (existing) {
      existing.email = email;
      existing.password = this.adminPassword;
      existing.username = this.adminUsername;
      existing.isAdmin = true;
      existing.approved = true;
      existing.writer = true;
      existing.resetRequested = false;

      this.saveAccounts(accounts);
      return;
    }

    const admin: LocalAccount = {
      id: 'admin-' + Date.now().toString(),
      email,
      password: this.adminPassword,
      username: this.adminUsername,
      approved: true,
      isAdmin: true,
      writer: true,
      resetRequested: false
    };

    accounts.push(admin);
    this.saveAccounts(accounts);
  }

  private getAccounts(): LocalAccount[] {
    try {
      const data =
        localStorage.getItem(this.accountsKey);

      if (!data) {
        return [];
      }

      const accounts = JSON.parse(data);

      if (!Array.isArray(accounts)) {
        return [];
      }

      return accounts.map(
        (account: any): LocalAccount => ({
          id: String(
            account.id ??
            ('user-' + Date.now().toString())
          ),

          email: String(
            account.email ?? ''
          ),

          password: String(
            account.password ?? ''
          ),

          username: String(
            account.username ?? ''
          ),

          approved:
            account.approved === true,

          isAdmin:
            account.isAdmin === true,

          writer:
            account.writer === true,

          resetRequested:
            account.resetRequested === true
        })
      );

    } catch {
      return [];
    }
  }

  private saveAccounts(
    accounts: LocalAccount[]
  ) {
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
        this.userInfo = undefined;
        return;
      }

      this.userInfo = JSON.parse(data);

    } catch {
      this.userInfo = undefined;
    }
  }

  private createUser(
    account: LocalAccount
  ): User {

    return {
      id: account.id,
      email: account.email,
      username: account.username,
      picture: '',
      privileges: {
        admin: account.isAdmin,
        writer: account.writer
      }
    } as User;
  }

  async register(
    email: string,
    password: string,
    username: string
  ) {

    email = email
      .trim()
      .toLowerCase();

    username = username.trim();

    if (!email) {
      return {
        success: false,
        message:
          'יש להזין כתובת אימייל.'
      };
    }

    if (!email.includes('@')) {
      return {
        success: false,
        message:
          'כתובת האימייל אינה תקינה.'
      };
    }

    if (!username) {
      return {
        success: false,
        message:
          'יש להזין שם משתמש.'
      };
    }

    if (password.length < 6) {
      return {
        success: false,
        message:
          'הסיסמה חייבת להכיל לפחות 6 תווים.'
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
      id:
        'user-' +
        Date.now().toString(),

      email,
      password,
      username,

      approved: false,

      isAdmin: false,

      writer: false,

      resetRequested: false
    };

    accounts.push(account);

    this.saveAccounts(accounts);

    return {
      success: false,

      status: 'pending',

      message:
        'ההרשמה התקבלה. החשבון ממתין לאישור מנהל.'
    };
  }

  async loginWithPassword(
    email: string,
    password: string
  ) {

    email = email
      .trim()
      .toLowerCase();

    const accounts =
      this.getAccounts();

    const account =
      accounts.find(
        item =>
          item.email === email
      );

    if (!account) {
      return {
        success: false,
        status: 'failed',
        message:
          'האימייל או הסיסמה שגויים.'
      };
    }

    if (account.password !== password) {
      return {
        success: false,
        status: 'failed',
        message:
          'האימייל או הסיסמה שגויים.'
      };
    }

    if (
      !account.approved &&
      !account.isAdmin
    ) {
      return {
        success: false,
        status: 'pending',
        message:
          'החשבון עדיין לא אושר על ידי המנהל.'
      };
    }

    const user =
      this.createUser(account);

    this.userInfo = user;

    localStorage.setItem(
      this.currentUserKey,
      JSON.stringify(user)
    );

    return {
      success: true,

      status:
        account.isAdmin
          ? 'admin'
          : 'approved'
    };
  }

  async loginWithGoogle() {

    return {
      success: false,

      status:
        'google_not_configured',

      message:
        'כניסה באמצעות Google עדיין אינה מחוברת.'
    };
  }

  async requestPasswordReset(
    email: string
  ) {

    email = email
      .trim()
      .toLowerCase();

    const accounts =
      this.getAccounts();

    const account =
      accounts.find(
        item =>
          item.email === email
      );

    if (!account) {
      return {
        success: false,
        message:
          'לא נמצא חשבון עם כתובת האימייל הזו.'
      };
    }

    account.resetRequested = true;

    this.saveAccounts(accounts);

    return {
      success: true,

      message:
        'בקשת איפוס הסיסמה נשלחה למנהל.'
    };
  }

  async resetUserPassword(
    userId: string,
    newPassword: string
  ) {

    if (!this.isAdmin()) {
      return {
        success: false,
        message:
          'אין הרשאת מנהל.'
      };
    }

    if (newPassword.length < 6) {
      return {
        success: false,
        message:
          'הסיסמה חייבת להכיל לפחות 6 תווים.'
      };
    }

    const accounts =
      this.getAccounts();

    const account =
      accounts.find(
        item =>
          item.id === userId
      );

    if (!account) {
      return {
        success: false,
        message:
          'המשתמש לא נמצא.'
      };
    }

    account.password =
      newPassword;

    account.resetRequested =
      false;

    this.saveAccounts(accounts);

    return {
      success: true,

      message:
        'הסיסמה שונתה בהצלחה.'
    };
  }

  getAllAccounts():
    LocalAccount[] {

    if (!this.isAdmin()) {
      return [];
    }

    return this.getAccounts();
  }

  async approveUser(
    userId: string
  ) {

    if (!this.isAdmin()) {
      return {
        success: false,
        message:
          'אין הרשאת מנהל.'
      };
    }

    const accounts =
      this.getAccounts();

    const account =
      accounts.find(
        item =>
          item.id === userId
      );

    if (!account) {
      return {
        success: false,
        message:
          'המשתמש לא נמצא.'
      };
    }

    account.approved = true;

    this.saveAccounts(accounts);

    return {
      success: true
    };
  }

  async rejectUser(
    userId: string
  ) {

    if (!this.isAdmin()) {
      return {
        success: false,
        message:
          'אין הרשאת מנהל.'
      };
    }

    const accounts =
      this.getAccounts();

    const index =
      accounts.findIndex(
        item =>
          item.id === userId
      );

    if (index === -1) {
      return {
        success: false,
        message:
          'המשתמש לא נמצא.'
      };
    }

    accounts.splice(index, 1);

    this.saveAccounts(accounts);

    return {
      success: true
    };
  }

  isAdmin(): boolean {

    return (
      this.userInfo
        ?.privileges
        ?.['admin'] === true
    );
  }

  isWriter(): boolean {

    return (
      this.userInfo
        ?.privileges
        ?.['writer'] === true
    );
  }

  async loadUserInfo():
    Promise<User | undefined> {

    this.restoreUser();

    return this.userInfo;
  }

  async logout() {

    this.userInfo =
      undefined;

    localStorage.removeItem(
      this.currentUserKey
    );

    return true;
  }

  async login(
    code: string
  ) {

    return false;
  }

  async registerAdmin(
    password: string
  ) {

    const accounts =
      this.getAccounts();

    const adminEmail =
      this.adminEmail
        .trim()
        .toLowerCase();

    const admin =
      accounts.find(
        account =>
          account.email === adminEmail
      );

    if (!admin) {
      return {
        success: false,
        message:
          'חשבון המנהל לא נמצא.'
      };
    }

    if (password.length < 6) {
      return {
        success: false,
        message:
          'הסיסמה חייבת להכיל לפחות 6 תווים.'
      };
    }

    admin.password =
      password;

    admin.approved =
      true;

    admin.isAdmin =
      true;

    admin.writer =
      true;

    this.saveAccounts(accounts);

    return {
      success: true
    };
  }
}
