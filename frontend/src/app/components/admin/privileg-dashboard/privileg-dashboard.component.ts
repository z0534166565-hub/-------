import { DatePipe } from '@angular/common';
import { Component, OnInit } from '@angular/core';
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
  implements OnInit {

  constructor(
    private adminService: AdminService,
    private tostService: NbToastrService,
    public authService: AuthService,
  ) {}

  // =========================================================
  // PENDING USERS
  // =========================================================

  pendingUsers: PendingUser[] = [];

  loadingPendingUsers = false;

  // =========================================================
  // APPROVED USERS
  // =========================================================

  privilegeUsersList: PrivilegeUser[] = [];

  addingNewUser = false;

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
  // INIT
  // =========================================================

  ngOnInit(): void {

    this.loadPendingUsers();

    this.loadPrivilegeUsers();

  }

  // =========================================================
  // LOAD PENDING USERS
  // =========================================================

  loadPendingUsers(): void {

    this.loadingPendingUsers = true;

    this.adminService
      .getPendingUsers()

      .then(list => {

        this.pendingUsers =
          list || [];

      })

      .catch(() => {

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
  // LOAD APPROVED USERS
  // =========================================================

  loadPrivilegeUsers(): void {

    this.adminService
      .getPrivilegeUsersList()

      .then(list => {

        this.privilegeUsersList =
          list || [];

      })

      .catch(() => {

        this.tostService.danger(
          '',
          'שגיאה בטעינת המשתמשים'
        );

      });
  }

  // =========================================================
  // APPROVE
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

      .then(() => {

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

      .catch(() => {

        this.tostService.danger(
          '',
          'שגיאה באישור המשתמש'
        );

      });
  }

  // =========================================================
  // REJECT
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

      .then(() => {

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

      .catch(() => {

        this.tostService.danger(
          '',
          'שגיאה בדחיית הבקשה'
        );

      });
  }

  // =========================================================
  // DELETE APPROVED USER
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
  }

  // =========================================================
  // ADD USER
  // =========================================================

  saveNewUser(): void {

    if (!this.newUser.email) {
      return;
    }

    this.privilegeUsersList.push({
      ...this.newUser,

      privileges: {
        ...this.newUser.privileges
      }
    });

    this.newUser =
      this.createEmptyUser();

    this.addingNewUser =
      false;
  }

  resetNewUser(): void {

    this.newUser =
      this.createEmptyUser();

    this.addingNewUser =
      false;
  }

  // =========================================================
  // SAVE USERS
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

      .catch(() => {

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
}
