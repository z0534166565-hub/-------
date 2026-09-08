import { Routes } from '@angular/router';

import { LoginComponent } from './components/login/login.component';
import { ChannelComponent } from './components/channel/channel.component';
import { PendingComponent } from './components/pending/pending.component';

import { AuthGuard } from './services/chat-guard.guard';

export const routes: Routes = [
  {
    path: 'login',
    component: LoginComponent
  },

  {
    path: 'pending',
    component: PendingComponent
  },

  {
    path: '',
    component: ChannelComponent,
    canActivate: [AuthGuard],
  },

  {
    path: '**',
    redirectTo: ''
  }
];