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
  createdAt: string;
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

  // =========================================================
  // ADMIN ACCOUNT
  // =========================================================

  private ensureAdminAccount(): void {

    const accounts =
      this.getAccounts();

    const email =
      this.adminEmail
        .trim()
        .toLowerCase();

    const existing =
      accounts.find(
        account =>
          account.email === email
      );

    if (existing) {

      existing.email =
        email;

      existing.password =
        this.adminPassword;

      existing.username =
        this.adminUsername;

      existing.isAdmin =
        true;

      existing.approved =
        true;

      existing.writer =
        true;

      existing.resetRequested =
        false;

      if (!existing.createdAt) {
        existing.createdAt =
          new Date().toISOString();
      }

      this.saveAccounts(accounts);

      return;
    }

    const admin: LocalAccount = {

      id:
        'admin-' +
        Date.now().toString(),

      email,

      password:
        this.adminPassword,

      username:
        this.adminUsername,

      approved:
        true,

      isAdmin:
        true,

      writer:
        true,

      resetRequested:
        false,

      createdAt:
        new Date().toISOString()
    };

    accounts.push(admin);

    this.saveAccounts(accounts);
  }

  // =========================================================
  // ACCOUNTS
  // =========================================================

  private getAccounts(): LocalAccount[] {

    try {

      const data =
        localStorage.getItem(
          this.accountsKey
        );

      if (!data) {
        return [];
      }

      const parsed =
        JSON.parse(data);

      if (!Array.isArray(parsed)) {
        return [];
      }

      return parsed.map(
        (account: any): LocalAccount => ({

          id:
            String(
              account.id ??
              (
                'user-' +
                Date.now().toString()
              )
            ),

          email:
            String(
              account.email ??
              ''
            )
            .trim()
            .toLowerCase(),

          password:
            String(
              account.password ??
              ''
            ),

          username:
            String(
              account.username ??
              ''
            ),

          approved:
            account.approved === true,

          isAdmin:
            account.isAdmin === true,

          writer:
            account.writer === true,

          resetRequested:
            account.resetRequested === true,

          createdAt:
            String(
              account.createdAt ??
              ''
            )
        })
      );

    } catch {

      return [];
    }
  }

  private saveAccounts(
    accounts: LocalAccount[]
  ): void {

    try {

      localStorage.setItem(
        this.accountsKey,
        JSON.stringify(accounts)
      );

    } catch (error) {

      console.error(
        'לא ניתן לשמור את המשתמשים:',
        error
      );
    }
  }

  // =========================================================
  // CURRENT USER
  // =========================================================

  private restoreUser(): void {

    try {

      const data =
        localStorage.getItem(
          this.currentUserKey
        );

      if (!data) {

        this.userInfo =
          undefined;

        return;
      }

      this.userInfo =
        JSON.parse(data);

    } catch {

      this.userInfo =
        undefined;
    }
  }

  private createUser(
    account: LocalAccount
  ): User {

    return {

      id:
        account.id,

      email:
        account.email,

      username:
        account.username,

      picture:
        '',

      privileges: {

        admin:
          account.isAdmin,

        writer:
          account.writer

      }

    } as User;
  }

  // =========================================================
  // REGISTER
  // =========================================================

  async register(
    email: string,
    password: string,
    username: string
  ) {

    email =
      email
        .trim()
        .toLowerCase();

    username =
      username.trim();

    // -------------------------------------------------------
    // VALIDATION
    // -------------------------------------------------------

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

    if (username.length < 2) {

      return {
        success: false,
        message:
          'שם המשתמש חייב להכיל לפחות 2 תווים.'
      };
    }

    if (!password) {

      return {
        success: false,
        message:
          'יש להזין סיסמה.'
      };
    }

    if (password.length < 6) {

      return {
        success: false,
        message:
          'הסיסמה חייבת להכיל לפחות 6 תווים.'
      };
    }

    // -------------------------------------------------------
    // LOAD CURRENT ACCOUNTS
    // -------------------------------------------------------

    const accounts =
      this.getAccounts();

    const existing =
      accounts.find(
        account =>
          account.email === email
      );

    if (existing) {

      if (
        existing.approved === false
      ) {

        return {
          success: false,
          status: 'pending',
          message:
            'כבר קיימת בקשת הצטרפות שממתינה לאישור מנהל.'
        };
      }

      return {
        success: false,
        message:
          'כבר קיים משתמש עם כתובת האימייל הזו.'
      };
    }

    // -------------------------------------------------------
    // CREATE PENDING ACCOUNT
    // -------------------------------------------------------

    const account: LocalAccount = {

      id:
        'user-' +
        Date.now().toString() +
        '-' +
        Math.random()
          .toString(36)
          .substring(2, 8),

      email,

      password,

      username,

      approved:
        false,

      isAdmin:
        false,

      writer:
        false,

      resetRequested:
        false,

      createdAt:
        new Date().toISOString()
    };

    // -------------------------------------------------------
    // SAVE REQUEST
    // -------------------------------------------------------

    accounts.push(account);

    this.saveAccounts(accounts);

    // -------------------------------------------------------
    // NOTIFY OTHER OPEN TABS
    // -------------------------------------------------------

    try {

      window.dispatchEvent(
        new CustomEvent(
          'channel-pending-user-created',
          {
            detail: {
              id: account.id,
              email: account.email
            }
          }
        )
      );

    } catch {
      // לא קריטי
    }

    return {

      success:
        false,

      status:
        'pending',

      message:
        'ההרשמה התקבלה. החשבון ממתין לאישור מנהל.'
    };
  }

  // =========================================================
  // LOGIN
  // =========================================================

  async loginWithPassword(
    email: string,
    password: string
  ) {

    email =
      email
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

        success:
          false,

        status:
          'failed',

        message:
          'האימייל או הסיסמה שגויים.'
      };
    }

    if (
      account.password !== password
    ) {

      return {

        success:
          false,

        status:
          'failed',

        message:
          'האימייל או הסיסמה שגויים.'
      };
    }

    if (
      !account.approved &&
      !account.isAdmin
    ) {

      return {

        success:
          false,

        status:
          'pending',

        message:
          'החשבון עדיין לא אושר על ידי המנהל.'
      };
    }

    const user =
      this.createUser(account);

    this.userInfo =
      user;

    localStorage.setItem(
      this.currentUserKey,
      JSON.stringify(user)
    );

    return {

      success:
        true,

      status:
        account.isAdmin
          ? 'admin'
          : 'approved'
    };
  }

  // =========================================================
  // GOOGLE LOGIN
  // =========================================================

  async loginWithGoogle() {

    return {

      success:
        false,

      status:
        'google_not_configured',

      message:
        'כניסה באמצעות Google עדיין אינה מחוברת.'
    };
  }

  // =========================================================
  // PASSWORD RESET REQUEST
  // =========================================================

  async requestPasswordReset(
    email: string
  ) {

    email =
      email
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

        success:
          false,

        message:
          'לא נמצא חשבון עם כתובת האימייל הזו.'
      };
    }

    account.resetRequested =
      true;

    this.saveAccounts(accounts);

    return {

      success:
        true,

      message:
        'בקשת איפוס הסיסמה נשלחה למנהל.'
    };
  }

  // =========================================================
  // RESET USER PASSWORD
  // =========================================================

  async resetUserPassword(
    userId: string,
    newPassword: string
  ) {

    if (!this.isAdmin()) {

      return {

        success:
          false,

        message:
          'אין הרשאת מנהל.'
      };
    }

    if (
      newPassword.length < 6
    ) {

      return {

        success:
          false,

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

        success:
          false,

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

      success:
        true,

      message:
        'הסיסמה שונתה בהצלחה.'
    };
  }

  // =========================================================
  // ALL ACCOUNTS
  // =========================================================

  getAllAccounts():
    LocalAccount[] {

    if (!this.isAdmin()) {
      return [];
    }

    return this.getAccounts();
  }

  // =========================================================
  // APPROVE USER
  // =========================================================

  async approveUser(
    userId: string
  ) {

    if (!this.isAdmin()) {

      return {

        success:
          false,

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

        success:
          false,

        message:
          'המשתמש לא נמצא.'
      };
    }

    account.approved =
      true;

    this.saveAccounts(accounts);

    return {
      success: true
    };
  }

  // =========================================================
  // REJECT USER
  // =========================================================

  async rejectUser(
    userId: string
  ) {

    if (!this.isAdmin()) {

      return {

        success:
          false,

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

        success:
          false,

        message:
          'המשתמש לא נמצא.'
      };
    }

    accounts.splice(
      index,
      1
    );

    this.saveAccounts(accounts);

    return {
      success: true
    };
  }

  // =========================================================
  // ADMIN
  // =========================================================

  isAdmin(): boolean {

    return (
      this.userInfo
        ?.privileges
        ?.['admin'] === true
    );
  }

  // =========================================================
  // WRITER
  // =========================================================

  isWriter(): boolean {

    return (
      this.userInfo
        ?.privileges
        ?.['writer'] === true
    );
  }

  // =========================================================
  // LOAD USER
  // =========================================================

  async loadUserInfo():
    Promise<User | undefined> {

    this.restoreUser();

    return this.userInfo;
  }

  // =========================================================
  // LOGOUT
  // =========================================================

  async logout() {

    this.userInfo =
      undefined;

    localStorage.removeItem(
      this.currentUserKey
    );

    return true;
  }

  // =========================================================
  // LEGACY LOGIN
  // =========================================================

  async login(
    code: string
  ) {

    return false;
  }

  // =========================================================
  // REGISTER ADMIN
  // =========================================================

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

        success:
          false,

        message:
          'חשבון המנהל לא נמצא.'
      };
    }

    if (
      password.length < 6
    ) {

      return {

        success:
          false,

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
