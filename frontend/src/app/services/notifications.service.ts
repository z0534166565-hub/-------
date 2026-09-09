import { Injectable } from '@angular/core';
import { NbToastrService } from '@nebular/theme';

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {

  public initialized = false;

  constructor(
    private tostrService: NbToastrService
  ) {}

  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // GitHub Pages הוא אתר סטטי,
    // ולכן אין טעינת הגדרות התראות משרת.
    this.initialized = true;
  }

  async requestPermission(): Promise<void> {

    if (typeof Notification === 'undefined') {
      this.tostrService.danger(
        '',
        'הדפדפן אינו תומך בהתראות.'
      );
      return;
    }

    if (Notification.permission === 'granted') {
      this.tostrService.success(
        '',
        'כבר אישרתם קבלת התראות!'
      );
      return;
    }

    try {
      const permission =
        await Notification.requestPermission();

      if (permission === 'granted') {
        this.tostrService.success(
          '',
          'התראות הופעלו בהצלחה!'
        );
      } else {
        this.tostrService.danger(
          '',
          'לא אושרה הרשאת התראות.'
        );
      }
    } catch {
      this.tostrService.danger(
        '',
        'שגיאה בהגדרת התראות!'
      );
    }
  }

  async subscribeNotifications(
    token: string
  ): Promise<boolean> {
    // אין שרת בגרסת GitHub Pages.
    // נשמרת התאימות לקוד הקיים.
    return !!token;
  }
}
