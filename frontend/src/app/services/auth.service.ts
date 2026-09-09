import { Injectable } from '@angular/core';
import { User } from '../models/user.model';

type LocalAccount = {
  email: string;
  password: string;
  username: string;
  isAdmin?: boolean;
};

@Injectable({
  providedIn: 'root'
})
export class AuthService {

  public userInfo?: User;

  private readonly accountsKey = 'channel_accounts';
  private readonly currentUserKey = 'channel_current_user';

  // ==========================================
  // פרטי חשבון מנהל
  // שנה כאן את הפרטים שאתה רוצה
  // ==========================================

  private readonly adminEmail =
    'Z0534166565@GMAIL.COM';

  private readonly adminPassword =
    'Admin0556786311';

  private readonly adminUsername =
    'מנהל';


  constructor() {
    this.restoreUser();
    this.ensureAdminAccount();
  }


  // ==========================================
  // יצירת חשבון מנהל אוטומטית
  // ==========================================

  private ensureAdminAccount() {

    const accounts =
      this.getAccounts();

    const adminEmail =
      this.adminEmail.trim().toLowerCase();

    const existingAdmin =
      accounts.find(
        account =>
          account.email === adminEmail
      );

    if (existingAdmin) {

      existingAdmin.password =
        this.adminPassword;

      existingAdmin.username =
        this.adminUsername;

      existingAdmin.isAdmin =
        true;

    } else {

      accounts.push({
        email: adminEmail,
        password: this.adminPassword,
        username: this.adminUsername,
        isAdmin: true
      });

    }

    this.saveAccounts(accounts);
  }


  // ==========================================
  // קריאת חשבונות
  // ==========================================

  private getAccounts(): LocalAccount[] {

    try {

      const data =
        localStorage.getItem(
          this.accountsKey
        );

      if (!data) {
        return [];
      }

      const accounts =
        JSON.parse(data);

      return Array.isArray(accounts)
        ? accounts
        : [];

    } catch {

      return [];

    }
  }


  // ==========================================
  // שמירת חשבונות
  // ==========================================

  private saveAccounts(
    accounts: LocalAccount[]
  ) {

    localStorage.setItem(
      this.accountsKey,
      JSON.stringify(accounts)
    );

  }


  // ==========================================
  // שחזור משתמש מחובר
  // ==========================================

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

      this.userInfo =
        undefined;

    }
  }


  // ==========================================
  // הרשמה
  // ==========================================

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


    if (!email) {

      return {
        success: false,
        message:
          'יש להזין כתובת אימייל.'
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

      email,

      password,

      username,

      isAdmin: false

    };


    accounts.push(account);

    this.saveAccounts(accounts);


    const user = {

      email,

      username,

      privileges: {
        admin: false,
        writer: false
      }

    } as User;


    this.userInfo =
      user;


    localStorage.setItem(
      this.currentUserKey,
      JSON.stringify(user)
    );


    return {
      success: true
    };

  }


  // ==========================================
  // כניסה עם אימייל וסיסמה
  // ==========================================

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
          item.email === email &&
          item.password === password
      );


    if (!account) {

      return {
        success: false,
        status: 'failed'
      };

    }


    // ========================================
    // בדיקה האם זה מנהל
    // ========================================

    const isAdmin =
      account.isAdmin === true ||
      account.email ===
        this.adminEmail
          .trim()
          .toLowerCase();


    const user = {

      email:
        account.email,

      username:
        account.username,

      privileges: {

        admin:
          isAdmin,

        writer:
          isAdmin

      }

    } as User;


    this.userInfo =
      user;


    localStorage.setItem(
      this.currentUserKey,
      JSON.stringify(user)
    );


    return {

      success: true,

      status:
        isAdmin
          ? 'admin'
          : 'approved'

    };

  }


  // ==========================================
  // Google
  // ==========================================

  async loginWithGoogle() {

    return {

      success: false,

      status:
        'disabled'

    };

  }


  // ==========================================
  // כניסה ישנה
  // ==========================================

  async login(
    code: string
  ) {

    return false;

  }


  // ==========================================
  // יציאה
  // ==========================================

  async logout() {

    this.userInfo =
      undefined;


    localStorage.removeItem(
      this.currentUserKey
    );


    return true;

  }


  // ==========================================
  // טעינת פרטי המשתמש
  // ==========================================

  async loadUserInfo():
    Promise<User | undefined> {

    this.restoreUser();

    return this.userInfo;

  }


  // ==========================================
  // בדיקה האם המשתמש מנהל
  // ==========================================

  isAdmin(): boolean {

    return (
      this.userInfo?.privileges?.['admin']
      === true
    );

  }


  // ==========================================
  // בדיקה האם המשתמש יכול לכתוב
  // ==========================================

  isWriter(): boolean {

    return (
      this.userInfo?.privileges?.['writer']
      === true
    );

  }

}
