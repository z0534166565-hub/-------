import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, Subject, of } from 'rxjs';

import { ChatFile, ChatMessage } from './chat.service';
import { ResponseResult } from '../models/response-result.model';
import { Setting } from '../models/setting.model';
import { Reports, Report } from '../models/report.model';
import { Statistics } from '../models/statistics.model';

export interface PrivilegeUser {
  id?: string;
  username: string;
  email: string;
  publicName: string;
  privileges: Record<string, boolean>;
}

export interface PendingUser {
  id: string;
  username: string;
  email: string;
  publicName: string;
  picture?: string;
  createdAt: string;
}

export type EditMsg = {
  new?: boolean;
  isScheduling?: boolean;
  message: ChatMessage;
};

@Injectable({
  providedIn: 'root'
})
export class AdminService {

  private messageEdit =
    new BehaviorSubject<EditMsg | undefined>(undefined);

  messageEditObservable =
    this.messageEdit.asObservable();

  private schedulingBus =
    new Subject<void>();

  schedulingBusObservable =
    this.schedulingBus.asObservable();

  private schedulingMessages:
    ChatMessage[] = [];

  private readonly privilegeUsersKey =
    'channel_privilege_users';

  private readonly pendingUsersKey =
    'channel_accounts';

  private readonly settingsKey =
    'channel_admin_settings';

  private readonly reportsKey =
    'channel_local_reports';

  private readonly scheduledMessagesKey =
    'channel_scheduled_messages';

  private readonly statisticsKey =
    'channel_statistics';

  private readonly emojisKey =
    'channel_local_emojis';

  constructor() {
    this.loadScheduledMessages();
  }

  // =========================================================
  // GENERAL
  // =========================================================

  reloadSchedulingMessage(): void {
    this.loadScheduledMessages();
    this.schedulingBus.next();
  }

  setEditMessage(
    edit: EditMsg | undefined
  ): void {
    this.messageEdit.next(edit);
  }

  getEditMessage(): EditMsg | undefined {
    return this.messageEdit.value;
  }

  // =========================================================
  // STATISTICS
  // =========================================================

  getStatistics(): Promise<Statistics> {
    try {
      const data =
        localStorage.getItem(
          this.statisticsKey
        );

      if (data) {
        return Promise.resolve(
          JSON.parse(data) as Statistics
        );
      }
    } catch {
      // שימוש בברירת המחדל
    }

    const statistics =
      this.createDefaultStatistics();

    return Promise.resolve(statistics);
  }

  resetPeakStatistics(): Promise<ResponseResult> {
    try {
      const statistics =
        this.createDefaultStatistics();

      localStorage.setItem(
        this.statisticsKey,
        JSON.stringify(statistics)
      );

      return Promise.resolve({
        success: true
      } as ResponseResult);

    } catch {
      return Promise.resolve({
        success: false
      } as ResponseResult);
    }
  }

  private createDefaultStatistics(): Statistics {
    return {
      views: 0,
      messages: 0,
      users: 0
    } as Statistics;
  }

  // =========================================================
  // MESSAGES
  // =========================================================

  addMessage(
    message: ChatMessage
  ): Observable<ChatMessage> {

    const messages =
      this.getLocalMessages();

    const newMessage: ChatMessage = {
      ...message,
      id:
        message.id ??
        this.nextMessageId(messages),
      timestamp:
        message.timestamp
          ? new Date(message.timestamp)
          : new Date(),
      reactions:
        message.reactions || {}
    };

    messages.push(newMessage);

    this.saveLocalMessages(messages);

    return of(newMessage);
  }

  editMessage(
    message: ChatMessage
  ): Observable<ChatMessage> {

    if (message.id === undefined) {
      return of(message);
    }

    const messages =
      this.getLocalMessages();

    const index =
      messages.findIndex(
        item => item.id === message.id
      );

    if (index === -1) {
      return of(message);
    }

    messages[index] = {
      ...messages[index],
      ...message,
      last_edit: new Date()
    };

    this.saveLocalMessages(messages);

    return of(messages[index]);
  }

  deleteMessage(
    id: number | undefined
  ): Observable<ChatMessage> {

    if (id === undefined) {
      return of({
        id,
        deleted: true
      } as ChatMessage);
    }

    const messages =
      this.getLocalMessages();

    const message =
      messages.find(
        item => item.id === id
      );

    if (message) {
      message.deleted = true;
      message.text = '';

      this.saveLocalMessages(messages);

      return of(message);
    }

    return of({
      id,
      deleted: true
    } as ChatMessage);
  }

  private getLocalMessages(): ChatMessage[] {
    try {
      const data =
        localStorage.getItem(
          'channel_local_messages'
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
        (message: any) => ({
          ...message,
          timestamp:
            message.timestamp
              ? new Date(message.timestamp)
              : new Date()
        })
      );

    } catch {
      return [];
    }
  }

  private saveLocalMessages(
    messages: ChatMessage[]
  ): void {
    try {
      localStorage.setItem(
        'channel_local_messages',
        JSON.stringify(messages)
      );
    } catch {
      // מתעלמים משגיאת אחסון
    }
  }

  private nextMessageId(
    messages: ChatMessage[]
  ): number {

    if (messages.length === 0) {
      return 1;
    }

    return (
      Math.max(
        ...messages.map(
          message =>
            Number(message.id || 0)
        )
      ) + 1
    );
  }

  // =========================================================
  // FILES
  // =========================================================

  uploadFile(
    formData: FormData
  ): Observable<any> {

    const file =
      formData.get('file');

    if (!(file instanceof File)) {
      return of({
        type: 4,
        body: {
          success: false
        }
      });
    }

    return new Observable(
      subscriber => {

        const reader =
          new FileReader();

        reader.onload = () => {

          const chatFile: ChatFile = {
            url:
              String(
                reader.result || ''
              ),
            filename:
              file.name,
            filetype:
              file.type ||
              'application/octet-stream'
          };

          subscriber.next({
            type: 4,
            body: chatFile
          });

          subscriber.complete();
        };

        reader.onerror = () => {
          subscriber.error(
            new Error(
              'לא ניתן לקרוא את הקובץ.'
            )
          );
        };

        reader.readAsDataURL(file);
      }
    );
  }

  // =========================================================
  // APPROVED / PRIVILEGE USERS
  // =========================================================

  getPrivilegeUsersList():
    Promise<PrivilegeUser[]> {

    try {
      const data =
        localStorage.getItem(
          this.privilegeUsersKey
        );

      if (!data) {
        return Promise.resolve([]);
      }

      const users =
        JSON.parse(data);

      return Promise.resolve(
        Array.isArray(users)
          ? users
          : []
      );

    } catch {
      return Promise.resolve([]);
    }
  }

  setPrivilegeUsers(
    privilegeUsers: PrivilegeUser[]
  ): Promise<ResponseResult> {

    try {
      localStorage.setItem(
        this.privilegeUsersKey,
        JSON.stringify(privilegeUsers)
      );

      return Promise.resolve({
        success: true
      } as ResponseResult);

    } catch {
      return Promise.resolve({
        success: false
      } as ResponseResult);
    }
  }

  // =========================================================
  // PENDING USERS
  // =========================================================

  getPendingUsers():
    Promise<PendingUser[]> {

    try {
      const data =
        localStorage.getItem(
          this.pendingUsersKey
        );

      if (!data) {
        return Promise.resolve([]);
      }

      const accounts =
        JSON.parse(data);

      if (!Array.isArray(accounts)) {
        return Promise.resolve([]);
      }

      const pending =
        accounts
          .filter(
            (account: any) =>
              account.approved !== true &&
              account.isAdmin !== true
          )
          .map(
            (account: any): PendingUser => ({
              id:
                String(
                  account.id ?? ''
                ),
              username:
                String(
                  account.username ?? ''
                ),
              email:
                String(
                  account.email ?? ''
                ),
              publicName:
                String(
                  account.username ?? ''
                ),
              picture: '',
              createdAt:
                String(
                  account.createdAt ??
                  ''
                )
            })
          );

      return Promise.resolve(pending);

    } catch {
      return Promise.resolve([]);
    }
  }

  async approvePendingUser(
    email: string
  ): Promise<ResponseResult> {

    return this.updatePendingUser(
      email,
      true
    );
  }

  async rejectPendingUser(
    email: string
  ): Promise<ResponseResult> {

    try {
      const accounts =
        this.getAccounts();

      const index =
        accounts.findIndex(
          account =>
            account.email ===
            email.trim().toLowerCase()
        );

      if (index === -1) {
        return {
          success: false
        } as ResponseResult;
      }

      accounts.splice(index, 1);

      this.saveAccounts(accounts);

      return {
        success: true
      } as ResponseResult;

    } catch {
      return {
        success: false
      } as ResponseResult;
    }
  }

  private async updatePendingUser(
    email: string,
    approved: boolean
  ): Promise<ResponseResult> {

    try {
      const accounts =
        this.getAccounts();

      const account =
        accounts.find(
          item =>
            item.email ===
            email.trim().toLowerCase()
        );

      if (!account) {
        return {
          success: false
        } as ResponseResult;
      }

      account.approved =
        approved;

      this.saveAccounts(accounts);

      return {
        success: true
      } as ResponseResult;

    } catch {
      return {
        success: false
      } as ResponseResult;
    }
  }

  private getAccounts(): any[] {

    try {
      const data =
        localStorage.getItem(
          this.pendingUsersKey
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

  private saveAccounts(
    accounts: any[]
  ): void {

    try {
      localStorage.setItem(
        this.pendingUsersKey,
        JSON.stringify(accounts)
      );
    } catch {
      // מתעלמים
    }
  }

  // =========================================================
  // EMOJIS
  // =========================================================

  setEmojis(
    emojis: string[] | undefined
  ): Promise<ResponseResult> {

    try {
      const list =
        Array.from(
          new Set(
            emojis || []
          )
        );

      localStorage.setItem(
        this.emojisKey,
        JSON.stringify(list)
      );

      return Promise.resolve({
        success: true
      } as ResponseResult);

    } catch {
      return Promise.resolve({
        success: false
      } as ResponseResult);
    }
  }

  // =========================================================
  // SETTINGS
  // =========================================================

  getSettings():
    Promise<Setting[]> {

    try {
      const data =
        localStorage.getItem(
          this.settingsKey
        );

      if (!data) {
        return Promise.resolve([]);
      }

      const settings =
        JSON.parse(data);

      return Promise.resolve(
        Array.isArray(settings)
          ? settings
          : []
      );

    } catch {
      return Promise.resolve([]);
    }
  }

  setSettings(
    settings: Setting[]
  ): Promise<ResponseResult> {

    try {
      localStorage.setItem(
        this.settingsKey,
        JSON.stringify(settings)
      );

      return Promise.resolve({
        success: true
      } as ResponseResult);

    } catch {
      return Promise.resolve({
        success: false
      } as ResponseResult);
    }
  }

  // =========================================================
  // REPORTS
  // =========================================================

  getReports(
    status: string
  ): Promise<Reports> {

    try {
      const data =
        localStorage.getItem(
          this.reportsKey
        );

      const reports =
        data
          ? JSON.parse(data)
          : [];

      if (!Array.isArray(reports)) {
        return Promise.resolve(
          [] as unknown as Reports
        );
      }

      const filtered =
        status === 'all'
          ? reports
          : reports.filter(
              (report: any) =>
                report.status === status
            );

      return Promise.resolve(
        filtered as Reports
      );

    } catch {
      return Promise.resolve(
        [] as unknown as Reports
      );
    }
  }

  setReports(
    report: Report
  ): Promise<ResponseResult> {

    try {
      const data =
        localStorage.getItem(
          this.reportsKey
        );

      const reports =
        data
          ? JSON.parse(data)
          : [];

      if (!Array.isArray(reports)) {
        return Promise.resolve({
          success: false
        } as ResponseResult);
      }

      reports.push(report);

      localStorage.setItem(
        this.reportsKey,
        JSON.stringify(reports)
      );

      return Promise.resolve({
        success: true
      } as ResponseResult);

    } catch {
      return Promise.resolve({
        success: false
      } as ResponseResult);
    }
  }

  // =========================================================
  // SCHEDULED MESSAGES
  // =========================================================

  async getScheduledMessages(
    reload?: boolean
  ): Promise<ChatMessage[]> {

    if (
      this.schedulingMessages.length > 0 &&
      !reload
    ) {
      return [
        ...this.schedulingMessages
      ];
    }

    this.loadScheduledMessages();

    return [
      ...this.schedulingMessages
    ];
  }

  setScheduledMessage(
    message: ChatMessage
  ): Promise<ResponseResult> {

    const newMessage: ChatMessage = {
      ...message,
      id:
        message.id ??
        this.nextScheduledId(),
      timestamp:
        message.timestamp
          ? new Date(message.timestamp)
          : new Date()
    };

    this.schedulingMessages.unshift(
      newMessage
    );

    this.saveScheduledMessages();

    this.schedulingBus.next();

    return Promise.resolve({
      success: true
    } as ResponseResult);
  }

  editScheduledMessage(
    message: ChatMessage
  ): Promise<ResponseResult> {

    if (message.id === undefined) {
      return Promise.resolve({
        success: false
      } as ResponseResult);
    }

    const index =
      this.schedulingMessages.findIndex(
        item => item.id === message.id
      );

    if (index === -1) {
      return Promise.resolve({
        success: false
      } as ResponseResult);
    }

    this.schedulingMessages[index] = {
      ...message
    };

    this.saveScheduledMessages();

    this.schedulingBus.next();

    return Promise.resolve({
      success: true
    } as ResponseResult);
  }

  deleteScheduledMessage(
    id: number | undefined
  ): Promise<ResponseResult> {

    if (id === undefined) {
      return Promise.resolve({
        success: false
      } as ResponseResult);
    }

    const index =
      this.schedulingMessages.findIndex(
        item => item.id === id
      );

    if (index === -1) {
      return Promise.resolve({
        success: false
      } as ResponseResult);
    }

    this.schedulingMessages.splice(
      index,
      1
    );

    this.saveScheduledMessages();

    this.schedulingBus.next();

    return Promise.resolve({
      success: true
    } as ResponseResult);
  }

  private loadScheduledMessages(): void {

    try {
      const data =
        localStorage.getItem(
          this.scheduledMessagesKey
        );

      if (!data) {
        this.schedulingMessages = [];
        return;
      }

      const messages =
        JSON.parse(data);

      if (!Array.isArray(messages)) {
        this.schedulingMessages = [];
        return;
      }

      this.schedulingMessages =
        messages.map(
          (message: any) => ({
            ...message,
            timestamp:
              message.timestamp
                ? new Date(
                    message.timestamp
                  )
                : new Date()
          })
        );

    } catch {
      this.schedulingMessages = [];
    }
  }

  private saveScheduledMessages(): void {

    try {
      localStorage.setItem(
        this.scheduledMessagesKey,
        JSON.stringify(
          this.schedulingMessages
        )
      );
    } catch {
      // מתעלמים
    }
  }

  private nextScheduledId(): number {

    if (
      this.schedulingMessages.length === 0
    ) {
      return 1;
    }

    return (
      Math.max(
        ...this.schedulingMessages.map(
          message =>
            Number(
              message.id || 0
            )
        )
      ) + 1
    );
  }

  private updateSchedulingMessages():
    Promise<ResponseResult> {

    this.saveScheduledMessages();

    this.schedulingBus.next();

    return Promise.resolve({
      success: true
    } as ResponseResult);
  }
}
