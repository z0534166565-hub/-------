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
 * EventSource מקומי.
 *
 * הוא שומר את הממשק שה-chat.component.ts
 * כבר מצפה לו, אבל אינו פותח חיבור לשרת.
 */
class LocalEventSource implements EventSource {

  readonly CONNECTING = 0;
  readonly OPEN = 1;
  readonly CLOSED = 2;

  readyState = 1;

  url = '';

  withCredentials = false;

  onerror: ((this: EventSource, ev: Event) => any) | null = null;

  onmessage: ((this: EventSource, ev: MessageEvent) => any) | null = null;

  onopen: ((this: EventSource, ev: Event) => any) | null = null;

  private closed = false;

  close(): void {
    this.closed = true;
    this.readyState = this.CLOSED;
  }

  addEventListener<K extends keyof EventSourceEventMap>(
    type: K,
    listener: (
      this: EventSource,
      ev: EventSourceEventMap[K]
    ) => any,
    options?: boolean | AddEventListenerOptions
  ): void;

  addEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | AddEventListenerOptions
  ): void;

  addEventListener(
    type: string,
    listener: any,
    options?: boolean | AddEventListenerOptions
  ): void {
    // אין חיבור שרת מקומי.
  }

  removeEventListener<K extends keyof EventSourceEventMap>(
    type: K,
    listener: (
      this: EventSource,
      ev: EventSourceEventMap[K]
    ) => any,
    options?: boolean | EventListenerOptions
  ): void;

  removeEventListener(
    type: string,
    listener: EventListenerOrEventListenerObject | null,
    options?: boolean | EventListenerOptions
  ): void;

  removeEventListener(
    type: string,
    listener: any,
    options?: boolean | EventListenerOptions
  ): void {
    // אין חיבור שרת מקומי.
  }

  dispatchEvent(event: Event): boolean {
    if (this.closed) {
      return false;
    }

    if (event.type === 'open') {
      this.onopen?.call(
        this,
        event
      );
    }

    if (event.type === 'message') {
      this.onmessage?.call(
        this,
        event as MessageEvent
      );
    }

    if (event.type === 'error') {
      this.onerror?.call(
        this,
        event
      );
    }

    return true;
  }
}

@Injectable({
  providedIn: 'root'
})
export class ChatService {

  private eventSource?: EventSource;

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

  constructor() {
    this.loadMessages();
    this.loadChannelInfo();
    this.loadEmojis();
  }

  // =========================================================
  // הודעות
  // =========================================================

  private loadMessages(): void {
    try {
      const data =
        localStorage.getItem(
          this.messagesKey
        );

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
        (message: any): ChatMessage => ({
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

  private saveMessages(): void {
    try {
      localStorage.setItem(
        this.messagesKey,
        JSON.stringify(this.messages)
      );
    } catch (error) {
      console.error(
        'לא ניתן לשמור את ההודעות:',
        error
      );
    }
  }

  private nextMessageId(): number {
    if (this.messages.length === 0) {
      return 1;
    }

    return (
      Math.max(
        ...this.messages.map(
          message =>
            Number(message.id || 0)
        )
      ) + 1
    );
  }

  getMessages(
    offset: number,
    limit: number,
    direction: string
  ): Observable<ChatResponse> {

    this.loadMessages();

    if (offset < 0) {
      offset = 0;
    }

    if (limit <= 0) {
      limit = 50;
    }

    let result =
      [...this.messages];

    if (direction === 'before') {
      result = result.reverse();
    }

    result =
      result.slice(
        offset,
        offset + limit
      );

    return of(result);
  }

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

    this.messages.push(
      newMessage
    );

    this.saveMessages();

    this.sendLocalMessageEvent(
      newMessage
    );

    return newMessage;
  }

  deleteMessage(
    messageId: number
  ): Observable<ResponseResult> {

    this.loadMessages();

    const message =
      this.messages.find(
        item =>
          item.id === messageId
      );

    if (!message) {
      return of({
        success: false
      } as ResponseResult);
    }

    message.deleted = true;
    message.text = '';

    this.saveMessages();

    this.sendLocalMessageEvent({
      id: messageId,
      deleted: true
    });

    return of({
      success: true
    } as ResponseResult);
  }

  editMessage(
    messageId: number,
    text: string
  ): Observable<ResponseResult> {

    this.loadMessages();

    const message =
      this.messages.find(
        item =>
          item.id === messageId
      );

    if (!message) {
      return of({
        success: false
      } as ResponseResult);
    }

    message.text = text;
    message.last_edit = new Date();

    this.saveMessages();

    this.sendLocalMessageEvent(
      message
    );

    return of({
      success: true
    } as ResponseResult);
  }

  // =========================================================
  // פרטי ערוץ
  // =========================================================

  private loadChannelInfo(): void {

    try {
      const data =
        localStorage.getItem(
          this.channelKey
        );

      if (data) {
        this.channelInfo =
          JSON.parse(data);

        return;
      }
    } catch {
      // שימוש בברירת המחדל
    }

    this.channelInfo = {
      name: 'עדכונים',
      description: 'ערוץ עדכונים',
      logoUrl: ''
    } as Channel;

    this.saveChannelInfo();
  }

  private saveChannelInfo(): void {

    if (!this.channelInfo) {
      return;
    }

    try {
      localStorage.setItem(
        this.channelKey,
        JSON.stringify(
          this.channelInfo
        )
      );
    } catch {
      // מתעלמים משגיאת אחסון
    }
  }

  async updateChannelInfo(): Promise<void> {
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
        item =>
          item.id === messageId
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

    this.sendLocalMessageEvent(
      message
    );

    return {
      success: true
    } as ResponseResult;
  }

  // =========================================================
  // אימוג'ים
  // =========================================================

  private loadEmojis(): void {

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
      // ברירת מחדל
    }
  }

  async getEmojisList(
    reload: boolean = false
  ): Promise<string[]> {

    if (
      !reload &&
      this.emojis.length > 0
    ) {
      return [...this.emojis];
    }

    this.loadEmojis();

    return [...this.emojis];
  }

  setEmojisList(
    emojis: string[]
  ): void {

    this.emojis =
      Array.from(
        new Set(emojis)
      );

    try {
      localStorage.setItem(
        this.emojisKey,
        JSON.stringify(
          this.emojis
        )
      );
    } catch {
      // מתעלמים
    }
  }

  // =========================================================
  // דיווח
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
        JSON.stringify(
          reports
        )
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

  sseListener(): EventSource {

    if (this.eventSource) {
      this.eventSource.close();
    }

    const localSource =
      new LocalEventSource();

    this.eventSource =
      localSource;

    return localSource;
  }

  sseClose(): void {

    if (this.eventSource) {
      this.eventSource.close();

      this.eventSource =
        undefined;
    }
  }

  private sendLocalMessageEvent(
    message: ChatMessage
  ): void {

    const source =
      this.eventSource;

    if (!source) {
      return;
    }

    const event =
      new MessageEvent(
        'message',
        {
          data: JSON.stringify(
            message
          )
        }
      );

    source.dispatchEvent(event);
  }

  // =========================================================
  // קבצים מקומיים
  // =========================================================

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

  async createChatFile(
    file: File
  ): Promise<ChatFile> {

    const url =
      await this.fileToDataUrl(file);

    return {
      url,
      filename: file.name,
      filetype:
        file.type ||
        'application/octet-stream'
    };
  }

  private fileToDataUrl(
    file: File
  ): Promise<string> {

    return new Promise(
      (resolve, reject) => {

        const reader =
          new FileReader();

        reader.onload = () => {
          resolve(
            String(
              reader.result || ''
            )
          );
        };

        reader.onerror = () => {
          reject(
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
  // ניקוי נתונים
  // =========================================================

  clearLocalMessages(): void {

    this.messages = [];

    localStorage.removeItem(
      this.messagesKey
    );

    this.sendLocalMessageEvent({
      id: 0,
      deleted: true
    });
  }

  clearLocalChatData(): void {

    this.messages = [];

    localStorage.removeItem(
      this.messagesKey
    );

    localStorage.removeItem(
      this.reportsKey
    );
  }
}
