import { DatePipe } from '@angular/common';
import {
  Component,
  OnDestroy,
  OnInit
} from '@angular/core';
import { FormsModule } from '@angular/forms';

import {
  NbButtonModule,
  NbCardModule,
  NbCheckboxModule,
  NbIconModule,
  NbInputModule,
  NbSpinnerModule,
  NbToastrService
} from '@nebular/theme';

import {
  AdminService,
  PendingUser,
  PrivilegeUser
} from '../../../services/admin.service';

import { AuthService } from '../../../services/auth.service';

@Component({
  selector: 'app-privileg-dashboard',

  imports: [
    NbCardModule,
    NbButtonModule,
    NbInputModule,
    FormsModule,
    NbIconModule,
    NbCheckboxModule,
    NbSpinnerModule,
    DatePipe
  ],

  templateUrl:
    './privileg-dashboard.component.html',

  styleUrl:
    './privileg-dashboard.component.scss'
})
export class PrivilegDashboardComponent
  implements OnInit, OnDestroy {

  // =========================================================
  // PENDING USERS
  // =========================================================

  pendingUsers: PendingUser[] = [];

  loadingPendingUsers =
    false;

  private refreshTimer:
    ReturnType<typeof setInterval> | undefined;

  private pendingUserListener:
    ((event: Event) => void) | undefined;


  // =========================================================
  // PRIVILEGE USERS
  // =========================================================

  privilegeUsersList:
    PrivilegeUser[] = [];

  addingNewUser =
    false;


  newUser: PrivilegeUser = {

    username: '',

    publicName: '',

    email: '',

    privileges: {

      admin: false,

      moderator: false,

      writer: false
    }
  };


  // =========================================================
  // CONSTRUCTOR
  // =========================================================

  constructor(

    private adminService:
      AdminService,

    private tostService:
      NbToastrService,

    public authService:
      AuthService

  ) {}


  // =========================================================
  // INIT
  // =========================================================

  ngOnInit(): void {

    this.loadPendingUsers();

    this.loadPrivilegeUsers();

    this.startAutoRefresh();

    this.listenForNewPendingUsers();
  }


  // =========================================================
  // LOAD PENDING USERS
  // =========================================================

  loadPendingUsers(): void {

    if (this.loadingPendingUsers) {
      return;
    }

    this.loadingPendingUsers =
      true;

    this.adminService
      .getPendingUsers()

      .then(list => {

        this.pendingUsers =
          list || [];

      })

      .catch(error => {

        console.error(
          'שגיאה בטעינת בקשות:',
          error
        );

        this.tostService.danger(
          '',
          'שגיאה בטעינת בקשות ההצטרפות'
        );

      })

      .finally(() => {

        this.loadingPendingUsers =
          false;
      });
  }


  // =========================================================
  // AUTO REFRESH
  // =========================================================

  private startAutoRefresh(): void {

    /*
     * כל 3 שניות בודקים אם נוספה בקשה.
     *
     * זה עובד גם כאשר המשתמש נרשם
     * באותה לשונית/חלון.
     */

    this.refreshTimer =
      setInterval(() => {

        this.loadPendingUsers();

      }, 3000);
  }


  // =========================================================
  // LISTEN FOR NEW USERS
  // =========================================================

  private listenForNewPendingUsers(): void {

    this.pendingUserListener =
      () => {

        this.loadPendingUsers();

      };

    window.addEventListener(
      'channel-pending-user-created',
      this.pendingUserListener
    );
  }


  // =========================================================
  // LOAD PRIVILEGE USERS
  // =========================================================

  loadPrivilegeUsers(): void {

    this.adminService
      .getPrivilegeUsersList()

      .then(list => {

        this.privilegeUsersList =
          list || [];

      })

      .catch(error => {

        console.error(
          'שגיאה בטעינת משתמשים:',
          error
        );

        this.tostService.danger(
          '',
          'שגיאה בטעינת המשתמשים'
        );
      });
  }


  // =========================================================
  // APPROVE USER
  // =========================================================

  approveUser(
    user: PendingUser
  ): void {

    if (
      !confirm(
        `האם לאשר את המשתמש ${user.email}?`
      )
    ) {

      return;
    }

    this.adminService
      .approvePendingUser(
        user.email
      )

      .then(result => {

        /*
         * אם השירות מחזיר false,
         * לא נמחק את המשתמש מהרשימה.
         */

        if (
          result &&
          (result as any).success === false
        ) {

          this.tostService.danger(
            '',
            (result as any).message ||
            'שגיאה באישור המשתמש'
          );

          return;
        }

        this.tostService.success(
          '',
          'המשתמש אושר בהצלחה'
        );

        this.pendingUsers =
          this.pendingUsers.filter(
            item =>
              item.email !== user.email
          );

        this.loadPrivilegeUsers();

      })

      .catch(error => {

        console.error(
          'שגיאה באישור:',
          error
        );

        this.tostService.danger(
          '',
          'שגיאה באישור המשתמש'
        );
      });
  }


  // =========================================================
  // REJECT USER
  // =========================================================

  rejectUser(
    user: PendingUser
  ): void {

    if (
      !confirm(
        `האם לדחות את הבקשה של ${user.email}?`
      )
    ) {

      return;
    }

    this.adminService
      .rejectPendingUser(
        user.email
      )

      .then(result => {

        if (
          result &&
          (result as any).success === false
        ) {

          this.tostService.danger(
            '',
            (result as any).message ||
            'שגיאה בדחיית הבקשה'
          );

          return;
        }

        this.tostService.success(
          '',
          'הבקשה נדחתה'
        );

        this.pendingUsers =
          this.pendingUsers.filter(
            item =>
              item.email !== user.email
          );

      })

      .catch(error => {

        console.error(
          'שגיאה בדחיית בקשה:',
          error
        );

        this.tostService.danger(
          '',
          'שגיאה בדחיית הבקשה'
        );
      });
  }


  // =========================================================
  // DELETE USER
  // =========================================================

  deleteUser(
    index: number
  ): void {

    if (
      !confirm(
        'האם אתה בטוח שברצונך למחוק את המשתמש הזה?'
      )
    ) {

      return;
    }

    this.privilegeUsersList.splice(
      index,
      1
    );

    /*
     * שומרים מיד לאחר המחיקה.
     */

    this.saveChanges();
  }


  // =========================================================
  // ADD USER
  // =========================================================

  saveNewUser(): void {

    if (
      !this.newUser.email
        ?.trim()
    ) {

      this.tostService.warning(
        '',
        'יש להזין כתובת אימייל'
      );

      return;
    }

    const email =
      this.newUser.email
        .trim()
        .toLowerCase();

    const exists =
      this.privilegeUsersList.some(
        user =>
          user.email
            ?.trim()
            .toLowerCase() === email
      );

    if (exists) {

      this.tostService.warning(
        '',
        'המשתמש כבר קיים ברשימה'
      );

      return;
    }

    this.privilegeUsersList.push({

      ...this.newUser,

      email,

      privileges: {

        ...this.newUser.privileges
      }
    });

    this.newUser =
      this.createEmptyUser();

    this.addingNewUser =
      false;
  }


  // =========================================================
  // RESET NEW USER
  // =========================================================

  resetNewUser(): void {

    this.newUser =
      this.createEmptyUser();

    this.addingNewUser =
      false;
  }


  // =========================================================
  // SAVE CHANGES
  // =========================================================

  saveChanges(): void {

    this.adminService
      .setPrivilegeUsers(
        this.privilegeUsersList
      )

      .then(() => {

        this.tostService.success(
          '',
          'השינויים נשמרו בהצלחה!'
        );

        this.loadPrivilegeUsers();

      })

      .catch(error => {

        console.error(
          'שגיאה בשמירת הרשאות:',
          error
        );

        this.tostService.danger(
          '',
          'שגיאה בשמירת השינויים'
        );
      });
  }


  // =========================================================
  // EMPTY USER
  // =========================================================

  private createEmptyUser():
    PrivilegeUser {

    return {

      username: '',

      publicName: '',

      email: '',

      privileges: {

        admin: false,

        moderator: false,

        writer: false
      }
    };
  }


  // =========================================================
  // DESTROY
  // =========================================================

  ngOnDestroy(): void {

    if (this.refreshTimer) {

      clearInterval(
        this.refreshTimer
      );

      this.refreshTimer =
        undefined;
    }

    if (
      this.pendingUserListener
    ) {

      window.removeEventListener(
        'channel-pending-user-created',
        this.pendingUserListener
      );

      this.pendingUserListener =
        undefined;
    }
  }
}
