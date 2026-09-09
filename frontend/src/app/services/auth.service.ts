import { Injectable } from '@angular/core';
import { User } from '../models/user.model';

type LocalAccount = {
  id: string;
  email: string;
  password: string;
  username: string;

  // משתמש שאושר יכול להיכנס
  approved: boolean;

  // מנהל
  isAdmin: boolean;

  // הרשאות
  writer: boolean;

  // איפוס סיסמה
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


  // ==========================================
  // פרטי מנהל
  // ==========================================

  private readonly adminEmail =
    'Z0534166565@GMAIL.COM';

  /*
   * 123456.
   *
   * קבע את הסיסמה של חשבון המנהל דרך
   * localStorage / כלי הניהול המקומי.
   */

  private readonly adminUsername =
    'מנהל';


  constructor() {

    this.ensureAdminAccount();

    this.restoreUser();

  }


  // ==========================================
  // יצירת מנהל
  // ==========================================

  private ensureAdminAccount() {

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

      existing.isAdmin = true;

      existing.approved = true;

      existing.writer = true;

      existing.username =
        this.adminUsername;

      this.saveAccounts(accounts);

      return;

    }


    /*
     * חשבון המנהל נוצר ללא סיסמה מוגדרת כאן.
     * אם אין חשבון כזה עדיין, צריך ליצור אותו
     * דרך registerAdmin().
     */

    const admin: LocalAccount = {

      id:
        'admin-' +
        Date.now().toString(),

      email,

      password: '',

      username:
        this.adminUsername,

      approved:
        true,

      isAdmin:
        true,

      writer:
        true,

      resetRequested:
        false

    };


    accounts.push(admin);

    this.saveAccounts(accounts);

  }


  // ==========================================
  // קריאת חשבונות
  // ==========================================

  private getAccounts():
    LocalAccount[] {

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


      if (!Array.isArray(accounts)) {

        return [];

      }


      return accounts.map(
        (account: any) => ({

          id:
            String(
              account.id ??
              Date.now()
            ),

          email:
            String(
              account.email ??
              ''
            ),

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
            account.resetRequested === true

        })
      );

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
  // שחזור משתמש
  // ==========================================

  private restoreUser() {

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


  // ==========================================
  // יצירת User
  // ==========================================

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

      // חשוב:
      // משתמש חדש אינו מאושר עדיין
      approved:
        false,

      isAdmin:
        false,

      writer:
        false,

      resetRequested:
        false

    };


    accounts.push(account);

    this.saveAccounts(accounts);


    /*
     * לא מחברים את המשתמש אוטומטית.
     *
     * הוא חייב להמתין לאישור מנהל.
     */

    return {

      success: false,

      status:
        'pending',

      message:
        'ההרשמה התקבלה. החשבון ממתין לאישור מנהל.'

    };

  }


  // ==========================================
  // כניסה
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
          item.email === email
      );


    if (!account) {

      return {

        success: false,

        status:
          'failed',

        message:
          'האימייל או הסיסמה שגויים.'

      };

    }


    // ========================================
    // בדיקת סיסמה
    // ========================================

    if (
      account.password !==
      password
    ) {

      return {

        success: false,

        status:
          'failed',

        message:
          'האימייל או הסיסמה שגויים.'

      };

    }


    // ========================================
    // בדיקת אישור
    // ========================================

    if (
      !account.approved &&
      !account.isAdmin
    ) {

      return {

        success: false,

        status:
          'pending',

        message:
          'החשבון עדיין לא אושר על ידי המנהל.'

      };

    }


    // ========================================
    // יצירת משתמש
    // ========================================

    const user =
      this.createUser(
        account
      );


    this.userInfo =
      user;


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


  // ==========================================
  // Google
  // ==========================================

  async loginWithGoogle() {

    return {

      success: false,

      status:
        'google_not_configured',

      message:
        'כניסה באמצעות Google עדיין אינה מחוברת.'

    };

  }


  // ==========================================
  // בקשת איפוס סיסמה
  // ==========================================

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

        success: false,

        message:
          'לא נמצא חשבון עם כתובת האימייל הזו.'

      };

    }


    account.resetRequested =
      true;


    this.saveAccounts(accounts);


    return {

      success: true,

      message:
        'בקשת איפוס הסיסמה נשלחה למנהל.'

    };

  }


  // ==========================================
  // איפוס סיסמה על ידי מנהל
  // ==========================================

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


    if (
      newPassword.length < 6
    ) {

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


  // ==========================================
  // קבלת משתמשים למנהל
  // ==========================================

  getAllAccounts():
    LocalAccount[] {

    if (!this.isAdmin()) {

      return [];

    }


    return this.getAccounts();

  }


  // ==========================================
  // אישור משתמש
  // ==========================================

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


    account.approved =
      true;


    this.saveAccounts(accounts);


    return {

      success: true

    };

  }


  // ==========================================
  // דחיית משתמש
  // ==========================================

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


    /*
     * מוחק את המשתמש.
     */

    accounts.splice(
      index,
      1
    );


    this.saveAccounts(accounts);


    return {

      success: true

    };

  }


  // ==========================================
  // בדיקת מנהל
  // ==========================================

  isAdmin(): boolean {

    return (

      this.userInfo
        ?.privileges
        ?.['admin']

      === true

    );

  }


  // ==========================================
  // בדיקת כותב
  // ==========================================

  isWriter(): boolean {

    return (

      this.userInfo
        ?.privileges
        ?.['writer']

      === true

    );

  }


  // ==========================================
  // משתמש נוכחי
  // ==========================================

  async loadUserInfo():
    Promise<User | undefined> {

    this.restoreUser();

    return this.userInfo;

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
  // כניסה ישנה
  // ==========================================

  async login(
    code: string
  ) {

    return false;

  }


  // ==========================================
  // יצירת מנהל מקומית
  // ==========================================

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
