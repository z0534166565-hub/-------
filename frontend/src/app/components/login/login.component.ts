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
  standalone: true,

  imports: [
    FormsModule,
    NbButtonModule,
    NbCardModule
  ],

  templateUrl: './login.component.html',
  styleUrl: './login.component.scss'
})
export class LoginComponent implements OnInit {

  // ==========================================
  // כניסה
  // ==========================================

  email = '';
  password = '';


  // ==========================================
  // הרשמה
  // ==========================================

  showRegister = false;

  registerUsername = '';
  registerEmail = '';
  registerPassword = '';
  registerPasswordConfirm = '';


  // ==========================================
  // איפוס סיסמה
  // ==========================================

  showForgotPassword = false;

  forgotEmail = '';


  // ==========================================
  // Google
  // ==========================================

  code = '';


  // ==========================================
  // מצב
  // ==========================================

  checkUserInfo = false;

  loading = false;

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


  // ==========================================
  // אתחול
  // ==========================================

  async ngOnInit() {

    this.checkUserInfo = true;

    try {

      await this._authService.loadUserInfo();

      if (this._authService.userInfo) {

        await this.router.navigate(['/']);

        return;

      }

    } catch {

      // אין משתמש מחובר

    }

    this.checkUserInfo = false;

  }


  // ==========================================
  // כניסה עם אימייל וסיסמה
  // ==========================================

  async loginWithPassword() {

    this.status = undefined;

    this.errorMessage = '';


    const email =
      this.email
        .trim()
        .toLowerCase();


    if (!email) {

      this.status = 'failed';

      this.errorMessage =
        'יש להזין כתובת אימייל.';

      return;

    }


    if (!email.includes('@')) {

      this.status = 'failed';

      this.errorMessage =
        'כתובת האימייל אינה תקינה.';

      return;

    }


    if (!this.password) {

      this.status = 'failed';

      this.errorMessage =
        'יש להזין סיסמה.';

      return;

    }


    this.loading = true;


    try {

      const result =
        await this._authService.loginWithPassword(
          email,
          this.password
        );


      // ======================================
      // כניסה הצליחה
      // ======================================

      if (result.success) {

        this.status = 'approved';

        await this.router.navigate(['/']);

        return;

      }


      // ======================================
      // משתמש ממתין לאישור
      // ======================================

      if (result.status === 'pending') {

        this.status = 'pending';

        this.errorMessage =
          result.message ||
          'החשבון עדיין ממתין לאישור מנהל.';

        return;

      }


      // ======================================
      // כניסה נכשלה
      // ======================================

      this.status = 'failed';

      this.errorMessage =
        result.message ||
        'האימייל או הסיסמה שגויים.';

    } catch {

      this.status = 'failed';

      this.errorMessage =
        'לא ניתן להתחבר כרגע.';

    } finally {

      this.loading = false;

    }

  }


  // ==========================================
  // הרשמה
  // ==========================================

  async register() {

    this.status = undefined;

    this.errorMessage = '';


    const username =
      this.registerUsername.trim();

    const email =
      this.registerEmail
        .trim()
        .toLowerCase();

    const password =
      this.registerPassword;

    const passwordConfirm =
      this.registerPasswordConfirm;


    // ========================================
    // שם משתמש
    // ========================================

    if (!username) {

      this.status = 'failed';

      this.errorMessage =
        'יש להזין שם משתמש.';

      return;

    }


    if (username.length < 2) {

      this.status = 'failed';

      this.errorMessage =
        'שם המשתמש חייב להכיל לפחות 2 תווים.';

      return;

    }


    // ========================================
    // אימייל
    // ========================================

    if (!email) {

      this.status = 'failed';

      this.errorMessage =
        'יש להזין כתובת אימייל.';

      return;

    }


    if (!email.includes('@')) {

      this.status = 'failed';

      this.errorMessage =
        'כתובת האימייל אינה תקינה.';

      return;

    }


    // ========================================
    // סיסמה
    // ========================================

    if (!password) {

      this.status = 'failed';

      this.errorMessage =
        'יש להזין סיסמה.';

      return;

    }


    if (password.length < 6) {

      this.status = 'failed';

      this.errorMessage =
        'הסיסמה חייבת להכיל לפחות 6 תווים.';

      return;

    }


    // ========================================
    // אימות סיסמה
    // ========================================

    if (password !== passwordConfirm) {

      this.status = 'failed';

      this.errorMessage =
        'הסיסמאות אינן תואמות.';

      return;

    }


    this.loading = true;


    try {

      const result =
        await this._authService.register(
          email,
          password,
          username
        );


      // ======================================
      // ממתין לאישור
      // ======================================

      if (result.status === 'pending') {

        this.status = 'pending';

        this.errorMessage =
          result.message ||
          'ההרשמה התקבלה וממתינה לאישור מנהל.';

        return;

      }


      // ======================================
      // הרשמה הצליחה
      // ======================================

      if (result.success) {

        this.status = 'approved';

        await this.router.navigate(['/']);

        return;

      }


      this.status = 'failed';

      this.errorMessage =
        result.message ||
        'ההרשמה נכשלה.';

    } catch {

      this.status = 'failed';

      this.errorMessage =
        'לא ניתן לבצע הרשמה כרגע.';

    } finally {

      this.loading = false;

    }

  }


  // ==========================================
  // Google
  // ==========================================

  async loginWithGoogle() {

    this.status = undefined;

    this.errorMessage = '';

    this.loading = true;


    try {

      const result =
        await this._authService.loginWithGoogle();


      if (result.success) {

        this.status = 'approved';

        await this.router.navigate(['/']);

        return;

      }


      this.status = 'failed';

      this.errorMessage =
        result.message ||
        'כניסה באמצעות Google עדיין אינה מוגדרת.';

    } catch {

      this.status = 'failed';

      this.errorMessage =
        'לא ניתן להתחבר באמצעות Google.';

    } finally {

      this.loading = false;

    }

  }


  // ==========================================
  // שכחתי סיסמה
  // ==========================================

  async requestPasswordReset() {

    this.status = undefined;

    this.errorMessage = '';


    const email =
      this.forgotEmail
        .trim()
        .toLowerCase();


    if (!email) {

      this.status = 'failed';

      this.errorMessage =
        'יש להזין את כתובת האימייל.';

      return;

    }


    if (!email.includes('@')) {

      this.status = 'failed';

      this.errorMessage =
        'כתובת האימייל אינה תקינה.';

      return;

    }


    this.loading = true;


    try {

      const result =
        await this._authService.requestPasswordReset(
          email
        );


      if (result.success) {

        this.status = 'pending';

        this.errorMessage =
          result.message ||
          'בקשת איפוס הסיסמה נשלחה למנהל.';

        return;

      }


      this.status = 'failed';

      this.errorMessage =
        result.message ||
        'לא ניתן לבצע איפוס סיסמה.';

    } catch {

      this.status = 'failed';

      this.errorMessage =
        'לא ניתן לבצע איפוס סיסמה כרגע.';

    } finally {

      this.loading = false;

    }

  }


  // ==========================================
  // מעבר למסך הכניסה
  // ==========================================

  showLogin() {

    this.showRegister = false;

    this.showForgotPassword = false;

    this.status = undefined;

    this.errorMessage = '';


    this.registerUsername = '';

    this.registerEmail = '';

    this.registerPassword = '';

    this.registerPasswordConfirm = '';

    this.forgotEmail = '';

  }


  // ==========================================
  // מעבר להרשמה
  // ==========================================

  showRegistration() {

    this.showRegister = true;

    this.showForgotPassword = false;

    this.status = undefined;

    this.errorMessage = '';


    this.email = '';

    this.password = '';

  }


  // ==========================================
  // מעבר לאיפוס סיסמה
  // ==========================================

  showForgotPasswordScreen() {

    this.showRegister = false;

    this.showForgotPassword = true;

    this.status = undefined;

    this.errorMessage = '';

  }

}
```

### 2. `login.component.html`

```html
<div
  class="login-container"
  dir="rtl"
>
  <nb-card class="login-card">

    <nb-card-header>

      <h2>

        {{
          showForgotPassword
            ? 'איפוס סיסמה'
            : (
                showRegister
                  ? 'הרשמה לערוץ'
                  : 'כניסה לערוץ'
              )
        }}

      </h2>

    </nb-card-header>


    <nb-card-body>


      <!-- ================================= -->
      <!-- טעינה -->
      <!-- ================================= -->

      @if (checkUserInfo || loading) {

        <div class="message">

          {{
            loading
              ? 'מתחבר...'
              : 'בודק את פרטי ההתחברות...'
          }}

        </div>

      }


      <!-- ================================= -->
      <!-- המתנה לאישור -->
      <!-- ================================= -->

      @else if (status === 'pending') {

        <div class="message pending">

          <div class="message-icon">
            ⏳
          </div>

          <h3>
            ממתין לאישור מנהל
          </h3>

          <p>
            {{
              errorMessage ||
              'החשבון ממתין לאישור מנהל.'
            }}
          </p>


          <button
            nbButton
            status="basic"
            fullWidth
            (click)="showLogin()"
          >
            חזרה למסך הכניסה
          </button>

        </div>

      }


      <!-- ================================= -->
      <!-- שגיאה -->
      <!-- ================================= -->

      @else if (status === 'failed') {

        <div class="message error">

          <div class="message-icon">
            ⚠️
          </div>


          <h3>

            {{
              showRegister
                ? 'ההרשמה נכשלה'
                : (
                    showForgotPassword
                      ? 'איפוס הסיסמה נכשל'
                      : 'ההתחברות נכשלה'
                  )
            }}

          </h3>


          <p>

            {{
              errorMessage ||
              'נסה שוב.'
            }}

          </p>


          <button
            nbButton
            status="basic"
            fullWidth
            (click)="status = undefined"
          >
            חזרה
          </button>

        </div>

      }


      <!-- ================================= -->
      <!-- שכחתי סיסמה -->
      <!-- ================================= -->

      @else if (showForgotPassword) {

        <div class="login-content">

          <p>
            הזן את כתובת האימייל של החשבון שלך
          </p>


          <div class="password-login">


            <div class="form-field">

              <label for="forgot-email">
                אימייל
              </label>


              <input
                id="forgot-email"
                type="email"
                autocomplete="email"
                placeholder="הזן את כתובת האימייל"
                [(ngModel)]="forgotEmail"
                (keyup.enter)="requestPasswordReset()"
              />

            </div>


            <button
              nbButton
              status="primary"
              size="large"
              fullWidth
              [disabled]="loading"
              (click)="requestPasswordReset()"
            >
              שליחת בקשת איפוס
            </button>


          </div>


          <div class="login-divider">
            <span>נזכרת בסיסמה?</span>
          </div>


          <button
            nbButton
            status="basic"
            size="large"
            fullWidth
            (click)="showLogin()"
          >
            חזרה לכניסה
          </button>

        </div>

      }


      <!-- ================================= -->
      <!-- הרשמה -->
      <!-- ================================= -->

      @else if (showRegister) {

        <div class="login-content">

          <p>
            צור חשבון חדש
          </p>


          <div class="password-login">


            <div class="form-field">

              <label for="register-username">
                שם משתמש
              </label>


              <input
                id="register-username"
                type="text"
                autocomplete="username"
                placeholder="הזן שם משתמש"
                [(ngModel)]="registerUsername"
              />

            </div>


            <div class="form-field">

              <label for="register-email">
                אימייל
              </label>


              <input
                id="register-email"
                type="email"
                autocomplete="email"
                placeholder="הזן כתובת אימייל"
                [(ngModel)]="registerEmail"
              />

            </div>


            <div class="form-field">

              <label for="register-password">
                סיסמה
              </label>


              <input
                id="register-password"
                type="password"
                autocomplete="new-password"
                placeholder="לפחות 6 תווים"
                [(ngModel)]="registerPassword"
                (keyup.enter)="register()"
              />

            </div>


            <div class="form-field">

              <label for="register-password-confirm">
                אימות סיסמה
              </label>


              <input
                id="register-password-confirm"
                type="password"
                autocomplete="new-password"
                placeholder="הזן שוב את הסיסמה"
                [(ngModel)]="registerPasswordConfirm"
                (keyup.enter)="register()"
              />

            </div>


            <button
              nbButton
              status="primary"
              size="large"
              fullWidth
              [disabled]="loading"
              (click)="register()"
            >
              הרשמה
            </button>


          </div>


          <div class="login-divider">
            <span>כבר יש לך חשבון?</span>
          </div>


          <button
            nbButton
            status="basic"
            size="large"
            fullWidth
            (click)="showLogin()"
          >
            כניסה לחשבון
          </button>


        </div>

      }


      <!-- ================================= -->
      <!-- כניסה -->
      <!-- ================================= -->

      @else {

        <div class="login-content">

          <p>
            התחבר באמצעות אימייל וסיסמה
          </p>


          <div class="password-login">


            <div class="form-field">

              <label for="login-email">
                אימייל
              </label>


              <input
                id="login-email"
                type="email"
                autocomplete="email"
                placeholder="הזן את כתובת האימייל"
                [(ngModel)]="email"
              />

            </div>


            <div class="form-field">

              <label for="login-password">
                סיסמה
              </label>


              <input
                id="login-password"
                type="password"
                autocomplete="current-password"
                placeholder="הזן סיסמה"
                [(ngModel)]="password"
                (keyup.enter)="loginWithPassword()"
              />

            </div>


            <button
              nbButton
              status="primary"
              size="large"
              fullWidth
              [disabled]="loading"
              (click)="loginWithPassword()"
            >
              כניסה עם אימייל וסיסמה
            </button>


            <button
              nbButton
              status="basic"
              size="small"
              fullWidth
              (click)="showForgotPasswordScreen()"
            >
              שכחתי סיסמה
            </button>


          </div>


          <div class="login-divider">
            <span>אין לך חשבון?</span>
          </div>


          <button
            nbButton
            status="basic"
            size="large"
            fullWidth
            (click)="showRegistration()"
          >
            יצירת חשבון חדש
          </button>


          <button
            nbButton
            status="basic"
            size="large"
            fullWidth
            class="login-google-button"
            [disabled]="loading"
            (click)="loginWithGoogle()"
          >
            כניסה באמצעות Google
          </button>


        </div>

      }


    </nb-card-body>

  </nb-card>

</div>
