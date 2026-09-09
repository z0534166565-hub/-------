
import { Injectable } from '@angular/core';
import { Observable, of } from 'rxjs';
import { Channel } from '../models/channel.model';
import { ResponseResult } from '../models/response-result.model';

export type MessageType =
  | 'md'
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'document'
  | 'other';

export type Reactions = {
  [key: string]: number;
};

export interface ChatMessage {
  id?: number;
  type?: MessageType;
  text?: string;
  timestamp?: Date;
  userId?: number | null;
  author?: string;
  authorId?: string;
  last_edit?: Date;
  deleted?: boolean;
  file?: ChatFile;
  views?: number;
  reactions?: Reactions;
  is_ads?: boolean;
}

export type ChatResponse = ChatMessage[];

export interface ChatFile {
  url: string;
  filename: string;
  filetype: string;
}

export interface Attachment {
  file: File;
  url?: string;
  uploadProgress?: number;
  uploading?: boolean;
  embedded?: string;
}

/**
 * שירות צ'אט מקומי.
 *
 * אין כאן:
 * - /api
 * - Render
 * - Firebase
 * - Supabase
 * - שרת חיצוני
 *
 * הנתונים נשמרים ב-localStorage של הדפדפן.
 */
@Injectable({
  providedIn: 'root'
})
export class ChatService {

  private readonly messagesKey =
    'channel_local_messages';

  private readonly channelKey =
    'channel_local_info';

  private readonly emojisKey =
    'channel_local_emojis';

  private readonly reportsKey =
    'channel_local_reports';

  private messages: ChatMessage[] = [];

  private emojis: string[] = [
    '👍',
    '❤️',
    '😂',
    '😮',
    '😢',
    '👏',
    '🔥',
    '🎉'
  ];

  public channelInfo?: Channel;

  /**
   * EventTarget מקומי שמחליף את SSE.
   * כך רכיבי Angular שמאזינים לאירועים
   * לא יקבלו שגיאת EventSource.
   */
  private localEvents = new EventTarget();

  constructor() {
    this.loadMessages();
    this.loadChannelInfo();
    this.loadEmojis();
  }

  // =========================================================
  // אחסון הודעות
  // =========================================================

  private loadMessages() {
    try {
      const data =
        localStorage.getItem(this.messagesKey);

      if (!data) {
        this.messages = [];
        return;
      }

      const parsed = JSON.parse(data);

      if (!Array.isArray(parsed)) {
        this.messages = [];
        return;
      }

      this.messages = parsed.map(
        (message: any) => ({
          ...message,

          timestamp:
            message.timestamp
              ? new Date(message.timestamp)
              : new Date(),

          last_edit:
            message.last_edit
              ? new Date(message.last_edit)
              : undefined,

          reactions:
            message.reactions || {}
        })
      );

    } catch {
      this.messages = [];
    }
  }

  private saveMessages() {
    localStorage.setItem(
      this.messagesKey,
      JSON.stringify(this.messages)
    );
  }

  private nextMessageId(): number {
    if (this.messages.length === 0) {
      return 1;
    }

    return Math.max(
      ...this.messages.map(
        message => Number(message.id || 0)
      )
    ) + 1;
  }

  // =========================================================
  // פרטי ערוץ
  // =========================================================

  private loadChannelInfo() {
    try {
      const data =
        localStorage.getItem(this.channelKey);

      if (data) {
        this.channelInfo =
          JSON.parse(data);

        return;
      }
    } catch {
      // ממשיכים לערכי ברירת מחדל
    }

    /**
     * אין לנו כאן API שמחזיר Channel.
     *
     * אם למודל Channel יש שדות חובה נוספים,
     * הם נשמרים/נטענים כאשר מנהל מעדכן את פרטי הערוץ.
     */
    this.channelInfo = {
      name: 'עדכונים',
      description: 'ערוץ עדכונים',
      logoUrl: ''
    } as Channel;

    this.saveChannelInfo();
  }

  private saveChannelInfo() {
    if (!this.channelInfo) {
      return;
    }

    localStorage.setItem(
      this.channelKey,
      JSON.stringify(this.channelInfo)
    );
  }

  async updateChannelInfo() {
    this.loadChannelInfo();
  }

  editChannelInfo(
    name: string,
    description: string,
    logoUrl: string
  ): Observable<ResponseResult> {

    this.channelInfo = {
      ...(this.channelInfo || {}),
      name,
      description,
      logoUrl
    } as Channel;

    this.saveChannelInfo();

    this.emitEvent('channel-updated', {
      channelInfo: this.channelInfo
    });

    return of({
      success: true
    } as ResponseResult);
  }

  // =========================================================
  // הודעות
  // =========================================================

  getMessages(
    offset: number,
    limit: number,
    direction: string
  ): Observable<ChatResponse> {

    this.loadMessages();

    let result = [...this.messages];

    if (direction === 'before') {
      result = result.reverse();
    }

    if (offset < 0) {
      offset = 0;
    }

    if (limit < 1) {
      limit = 50;
    }

    result =
      result.slice(
        offset,
        offset + limit
      );

    return of(result);
  }

  /**
   * הוספת הודעה מקומית.
   *
   * שימושי אם רכיב אחר באתר רוצה להוסיף
   * הודעה בלי שרת.
   */
  addMessage(
    message: ChatMessage
  ): ChatMessage {

    this.loadMessages();

    const newMessage: ChatMessage = {
      ...message,

      id:
        message.id ??
        this.nextMessageId(),

      timestamp:
        message.timestamp
          ? new Date(message.timestamp)
          : new Date(),

      reactions:
        message.reactions || {},

      deleted:
        message.deleted === true
    };

    this.messages.push(newMessage);

    this.saveMessages();

    this.emitEvent(
      'message-created',
      newMessage
    );

    return newMessage;
  }

  /**
   * מחיקת הודעה מקומית.
   */
  deleteMessage(
    messageId: number
  ): Observable<ResponseResult> {

    this.loadMessages();

    const message =
      this.messages.find(
        item => item.id === messageId
      );

    if (!message) {
      return of({
        success: false
      } as ResponseResult);
    }

    message.deleted = true;
    message.text = '';

    this.saveMessages();

    this.emitEvent(
      'message-deleted',
      {
        id: messageId
      }
    );

    return of({
      success: true
    } as ResponseResult);
  }

  /**
   * עריכת הודעה מקומית.
   */
  editMessage(
    messageId: number,
    text: string
  ): Observable<ResponseResult> {

    this.loadMessages();

    const message =
      this.messages.find(
        item => item.id === messageId
      );

    if (!message) {
      return of({
        success: false
      } as ResponseResult);
    }

    message.text = text;

    message.last_edit =
      new Date();

    this.saveMessages();

    this.emitEvent(
      'message-updated',
      message
    );

    return of({
      success: true
    } as ResponseResult);
  }

  // =========================================================
  // תגובות
  // =========================================================

  async setReact(
    messageId: number,
    react: string
  ): Promise<ResponseResult> {

    this.loadMessages();

    const message =
      this.messages.find(
        item => item.id === messageId
      );

    if (!message) {
      return {
        success: false
      } as ResponseResult;
    }

    if (!message.reactions) {
      message.reactions = {};
    }

    message.reactions[react] =
      (message.reactions[react] || 0) + 1;

    this.saveMessages();

    this.emitEvent(
      'reaction-updated',
      {
        messageId,
        emoji: react
      }
    );

    return {
      success: true
    } as ResponseResult;
  }

  // =========================================================
  // אימוג'ים
  // =========================================================

  private loadEmojis() {
    try {
      const data =
        localStorage.getItem(
          this.emojisKey
        );

      if (!data) {
        return;
      }

      const parsed =
        JSON.parse(data);

      if (Array.isArray(parsed)) {
        this.emojis = parsed;
      }

    } catch {
      // ברירת המחדל נשארת
    }
  }

  async getEmojisList(
    reload: boolean = false
  ): Promise<string[]> {

    if (!reload && this.emojis.length > 0) {
      return [...this.emojis];
    }

    this.loadEmojis();

    return [...this.emojis];
  }

  setEmojisList(
    emojis: string[]
  ) {

    this.emojis =
      Array.from(
        new Set(emojis)
      );

    localStorage.setItem(
      this.emojisKey,
      JSON.stringify(this.emojis)
    );

    this.emitEvent(
      'emojis-updated',
      this.emojis
    );
  }

  // =========================================================
  // דיווח על הודעה
  // =========================================================

  reportMessage(
    messageId: number,
    reason: string
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

      reports.push({
        messageId,
        reason,
        timestamp:
          new Date().toISOString()
      });

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
  // SSE מקומי
  // =========================================================

  /**
   * במקום:
   *
   * new EventSource('/api/events')
   *
   * אנחנו מחזירים EventTarget מקומי.
   *
   * חשוב:
   * זה לא חיבור בין משתמשים.
   * זה עובד בתוך הדפדפן הנוכחי בלבד.
   */
  sseListener(): EventTarget {

    return this.localEvents;
  }

  sseClose() {
    // אין חיבור שרת לסגור.
  }

  /**
   * מאפשר לרכיבים אחרים להאזין לאירוע מסוים.
   */
  addEventListener(
    eventName: string,
    callback: EventListenerOrEventListenerObject
  ) {

    this.localEvents.addEventListener(
      eventName,
      callback
    );
  }

  removeEventListener(
    eventName: string,
    callback: EventListenerOrEventListenerObject
  ) {

    this.localEvents.removeEventListener(
      eventName,
      callback
    );
  }

  private emitEvent(
    eventName: string,
    data: any
  ) {

    const event =
      new CustomEvent(
        eventName,
        {
          detail: data
        }
      );

    this.localEvents.dispatchEvent(
      event
    );
  }

  // =========================================================
  // קבצים
  // =========================================================

  /**
   * אין שרת להעלות אליו קובץ.
   *
   * לכן קובץ מקומי הופך ל-Data URL.
   * זה מתאים לקבצים קטנים בלבד.
   */
  async prepareAttachment(
    file: File
  ): Promise<Attachment> {

    const url =
      await this.fileToDataUrl(file);

    return {
      file,
      url,
      uploadProgress: 100,
      uploading: false,
      embedded: url
    };
  }

  private fileToDataUrl(
    file: File
  ): Promise<string> {

    return new Promise(
      (resolve, reject) => {

        const reader =
          new FileReader();

        reader.onload = () =>
          resolve(
            String(reader.result || '')
          );

        reader.onerror =
          () =>
            reject(
              new Error(
                'לא ניתן לקרוא את הקובץ.'
              )
            );

        reader.readAsDataURL(file);
      }
    );
  }

  /**
   * יוצר ChatFile מקובץ מקומי.
   */
  async createChatFile(
    file: File
  ): Promise<ChatFile> {

    const url =
      await this.fileToDataUrl(file);

    return {
      url,
      filename: file.name,
      filetype:
        file.type || 'application/octet-stream'
    };
  }

  // =========================================================
  // ניקוי נתונים מקומיים
  // =========================================================

  clearLocalMessages() {

    this.messages = [];

    localStorage.removeItem(
      this.messagesKey
    );

    this.emitEvent(
      'messages-cleared',
      {}
    );
  }

  clearLocalChatData() {

    this.messages = [];

    localStorage.removeItem(
      this.messagesKey
    );

    localStorage.removeItem(
      this.reportsKey
    );

    this.emitEvent(
      'messages-cleared',
      {}
    );
  }
}
