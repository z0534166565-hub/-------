import {
  Component,
  OnInit,
  NgZone,
  OnDestroy,
  HostListener,
  AfterViewInit
} from '@angular/core';

import { FormsModule } from '@angular/forms';

import {
  NbBadgeModule,
  NbButtonModule,
  NbCardModule,
  NbChatModule,
  NbIconModule,
  NbLayoutModule,
  NbListModule,
  NbToastrService
} from '@nebular/theme';

import { MessageComponent } from './message/message.component';

import {
  firstValueFrom,
  interval
} from 'rxjs';

import {
  ChatMessage,
  ChatService
} from '../../../services/chat.service';

import { AuthService } from '../../../services/auth.service';

import { ActivatedRoute } from '@angular/router';

import { NotificationsService } from '../../../services/notifications.service';

import { User } from '../../../models/user.model';

import { AdminService } from '../../../services/admin.service';


type LoadMsgOpt = {
  scrollDown?: boolean;
  messageId?: number;
  mark?: boolean;
  resetList?: boolean;
};


type ScrollOpt = {
  messageId: number;
  smooth?: boolean;
  mark?: boolean;
};


@Component({
  selector: 'app-chat',
  standalone: true,

  imports: [
    FormsModule,
    NbLayoutModule,
    NbChatModule,
    NbCardModule,
    NbIconModule,
    NbButtonModule,
    NbListModule,
    NbBadgeModule,
    MessageComponent
  ],

  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss'
})


export class ChatComponent
  implements OnInit, OnDestroy, AfterViewInit {

  private eventSource!: EventSource;

  messages: ChatMessage[] = [];

  scheduledMessages!: ChatMessage[];

  hideScheduledMessages = false;

  userInfo?: User;

  isLoading = false;

  offset = 0;

  limit = 20;

  hasOldMessages = true;

  hasNewMessages = false;

  thereNewMessages = false;

  showScrollToBottom = false;

  private lastHeartbeat = Date.now();

  private subLastHeartbeat: any;

  lastReadMessageId = 0;


  constructor(
    private chatService: ChatService,
    private _authService: AuthService,
    private _adminService: AdminService,
    private toastrService: NbToastrService,
    private notificationService: NotificationsService,
    private zone: NgZone,
    private router: ActivatedRoute
  ) {

    this._adminService
      .schedulingBusObservable
      .subscribe(() => {

        this.loadScheduledMessages();

      });

  }


  private sortMessages(): void {

    this.messages =
      this.messages
        .filter(message =>
          message &&
          Number.isFinite(message.id)
        )
        .sort((a, b) =>
          Number(a.id) - Number(b.id)
        );

  }


  @HostListener('window:scroll', [])
  onWindowScroll() {

    this.onListScroll();

  }


  @HostListener('document:keydown', ['$event'])
  @HostListener('window:click', ['$event'])
  onUserAction(
    event: MouseEvent | KeyboardEvent
  ) {

    this.removeMsgMarked();

    const target =
      event.target as HTMLElement;

    const quoteElement =
      target.closest('[quote-id]');

    if (quoteElement) {

      const quoteId =
        quoteElement.getAttribute('quote-id');

      if (!quoteId) {
        return;
      }

      this.scrollToId({
        messageId: Number(quoteId),
        smooth: true,
        mark: true
      });

    }

  }


  scrollToId(opt: ScrollOpt) {

    const element =
      document.getElementById(
        opt.messageId.toString()
      );

    if (element) {

      element.scrollIntoView({
        behavior: opt.smooth
          ? 'smooth'
          : 'auto',
        block: 'center'
      });

      this.removeMsgMarked();

      if (opt.mark) {

        element.classList.add(
          'mark_message'
        );

      }

    } else {

      this.loadMessages({
        scrollDown: false,
        messageId: opt.messageId,
        mark: opt.mark
      });

    }

  }


  private removeMsgMarked() {

    document
      .querySelectorAll('.mark_message')
      .forEach(el => {

        el.classList.remove(
          'mark_message'
        );

      });

  }


  ngAfterViewInit(): void {

    setTimeout(() => {

      this.router.fragment.subscribe(
        fragment => {

          if (!fragment) {
            return;
          }

          const messageId =
            Number(fragment);

          if (!Number.isInteger(messageId)) {
            return;
          }

          this.scrollToId({
            messageId,
            mark: true
          });

        }
      );

    }, 800);

  }


  ngOnInit() {

    this.chatService.getEmojisList(true);

    this.initializeMessageListener();

    this.keepAliveSSE();


    this._authService
      .loadUserInfo()
      .then(res => {

        this.userInfo = res;

        if (
          this.userInfo
            ?.privileges
            ?.['writer']
        ) {

          this.loadScheduledMessages();

        }

        this.notificationService.init();

      })
      .catch(() => {

        this.userInfo = undefined;

      });


    this.loadMessages()
      .then(() => {

        if (!this.messages.length) {
          return;
        }

        this.sortMessages();

        const lastReadMsg =
          Number(
            localStorage.getItem(
              'lastReadMessage'
            )
          );

        const newestMessage =
          this.messages[
            this.messages.length - 1
          ];

        const newestMessageId =
          Number(newestMessage.id);


        if (
          lastReadMsg &&
          lastReadMsg < newestMessageId
        ) {

          setTimeout(() => {

            this.scrollToId({
              messageId: lastReadMsg,
              smooth: false,
              mark: false
            });

            this.lastReadMessageId =
              lastReadMsg;

          }, 200);

        } else {

          this.scrollToBottom(false);

        }


        this.setLastReadMessage(
          newestMessageId.toString()
        );

      });

  }


  async setLastReadMessage(id: string) {

    localStorage.setItem(
      'lastReadMessage',
      id
    );

  }


  private async initializeMessageListener() {

    this.eventSource =
      this.chatService.sseListener();


    this.eventSource.onmessage =
      (event) => {

        this.lastHeartbeat =
          Date.now();

        let data: any;

        try {

          data =
            JSON.parse(event.data);

        } catch {

          return;

        }


        switch (data.type) {

          case 'new-message': {

            const newMessage =
              data.message as ChatMessage;

            if (!newMessage) {
              break;
            }

            this.zone.run(() => {

              const exists =
                this.messages.some(
                  message =>
                    message.id ===
                    newMessage.id
                );

              if (!exists) {

                this.messages.push(
                  newMessage
                );

              }

              this.sortMessages();


              this.thereNewMessages =
                newMessage.author !==
                this.userInfo?.username;


              this.setLastReadMessage(
                String(newMessage.id)
              );


              if (
                this.userInfo
                  ?.privileges
                  ?.['writer'] &&
                this.scheduledMessages &&
                newMessage.author ===
                'Scheduled'
              ) {

                this.loadScheduledMessages(true);

              }


              const distanceFromBottom =
                document.documentElement.scrollHeight -
                window.innerHeight -
                window.scrollY;


              if (
                distanceFromBottom < 150
              ) {

                setTimeout(() => {

                  this.scrollToBottom(true);

                }, 50);

              }

            });

            break;
          }


          case 'delete-message': {

            if (
              this.userInfo
                ?.privileges
                ?.['writer']
            ) {

              this.zone.run(() => {

                const index =
                  this.messages.findIndex(
                    m =>
                      m.id ===
                      data.message.id
                  );

                if (index !== -1) {

                  this.messages[index].deleted =
                    true;

                  this.messages[index].last_edit =
                    data.message.last_edit;

                }

              });

              break;
            }


            this.zone.run(() => {

              this.messages =
                this.messages.filter(
                  m =>
                    m.id !==
                    data.message.id
                );

            });

            break;
          }


          case 'edit-message': {

            this.zone.run(() => {

              const index =
                this.messages.findIndex(
                  m =>
                    m.id ===
                    data.message.id
                );

              if (index !== -1) {

                this.messages[index] =
                  data.message;

              }

              this.sortMessages();

            });

            break;
          }


          case 'reaction': {

            this.zone.run(() => {

              const index =
                this.messages.findIndex(
                  m =>
                    m.id ===
                    data.message.id
                );

              if (index !== -1) {

                this.messages[index].reactions =
                  data.message.reactions;

              }

            });

            break;
          }


          case 'heartbeat': {

            this.lastHeartbeat =
              Date.now();

            break;
          }

        }

      };

  }


  ngOnDestroy() {

    this.chatService.sseClose();

    clearInterval(
      this.subLastHeartbeat
    );

  }


  async keepAliveSSE() {

    clearInterval(
      this.subLastHeartbeat
    );

    this.subLastHeartbeat =
      interval(10000)
        .subscribe(() => {

          if (
            Date.now() -
            this.lastHeartbeat >
            60000
          ) {

            this.lastHeartbeat =
              Date.now();

            this.initializeMessageListener();

          }

        });

  }


  onListScroll() {

    const distanceFromBottom =
      document.documentElement.scrollHeight -
      window.innerHeight -
      window.scrollY;


    this.showScrollToBottom =
      distanceFromBottom > 100;


    if (
      distanceFromBottom < 10
    ) {

      this.thereNewMessages =
        false;

    }

  }


  async scrollToBottom(
    smooth: boolean = true
  ) {

    if (this.hasNewMessages) {

      this.hasNewMessages =
        false;

      await this.loadMessages({
        resetList: true
      });

    }


    setTimeout(() => {

      window.scrollTo({

        top:
          document.documentElement
            .scrollHeight,

        behavior:
          smooth
            ? 'smooth'
            : 'auto'

      });

    }, 100);


    this.thereNewMessages =
      false;

  }


  private async loadScheduledMessages(
    reload: boolean = false
  ) {

    this._adminService
      .getScheduledMessages(reload)

      .then(messages => {

        this.scheduledMessages =
          messages;

      })

      .catch(() => {

        this.toastrService.danger(
          '',
          'הייתה בעיה בטעינת ההודעות המתוזמנות.'
        );

      });

  }


  async loadMessages(
    opt: LoadMsgOpt = {}
  ) {

    if (
      this.isLoading ||
      (
        opt.scrollDown &&
        !this.hasNewMessages
      ) ||
      (
        !opt.scrollDown &&
        !this.hasOldMessages
      )
    ) {

      return;
    }


    let startId: number;

    let resetList =
      opt.resetList || false;

    let direction =
      'desc';


    if (opt.resetList) {

      this.offset = 0;

    }


    const ids =
      this.messages
        .map(m => Number(m.id))
        .filter(id =>
          Number.isFinite(id)
        );


    const maxId =
      ids.length
        ? Math.max(...ids)
        : 0;


    if (opt.scrollDown) {

      direction = 'asc';

      startId = maxId;

    } else {

      if (opt.messageId) {

        if (
          opt.messageId >
          maxId + this.limit
        ) {

          resetList = true;

          this.hasNewMessages =
            true;

          this.hasOldMessages =
            true;

          startId =
            opt.messageId + 10;

          direction = 'asc';

          opt.scrollDown = true;

        } else if (
          opt.messageId > maxId
        ) {

          startId =
            maxId;

          direction = 'asc';

          opt.scrollDown = true;

        } else {

          if (
            opt.messageId <
            this.offset - this.limit
          ) {

            resetList = true;

            this.hasNewMessages =
              true;

            this.hasOldMessages =
              true;

            startId =
              opt.messageId + 10;

          } else {

            startId =
              this.offset;

          }

        }

      } else {

        startId =
          this.offset;

      }

    }


    try {

      this.isLoading = true;


      const response =
        await firstValueFrom(
          this.chatService.getMessages(
            startId,
            this.limit,
            direction
          )
        );


      if (response) {

        if (opt.scrollDown) {

          const newMessages =
            [...response].reverse();


          if (resetList) {

            this.messages =
              newMessages;

          } else {

            this.messages.unshift(
              ...newMessages
            );

          }

          this.hasNewMessages =
            response.length >=
            this.limit;

        } else {

          if (resetList) {

            this.messages =
              [...response];

          } else {

            this.messages.push(
              ...response
            );

          }

          this.hasOldMessages =
            response.length >=
            this.limit;

        }


        this.sortMessages();


        const messageIds =
          this.messages
            .map(m => Number(m.id))
            .filter(id =>
              Number.isFinite(id)
            );


        if (messageIds.length) {

          this.offset =
            Math.min(
              ...messageIds
            );

        }


        setTimeout(() => {

          if (opt.messageId) {

            this.scrollToId({

              messageId:
                opt.messageId,

              smooth:
                false,

              mark:
                opt.mark

            });

          }

        }, 300);

      }

    } catch (error) {

      console.error(
        'שגיאה בטעינת הודעות:',
        error
      );

    } finally {

      this.isLoading = false;

    }

  }

}
