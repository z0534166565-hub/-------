import { Injectable } from '@angular/core';

export interface Ad {
  src: string;
  width: number;
}

@Injectable({
  providedIn: 'root'
})
export class AdsService {

  private readonly defaultAd: Ad = {
    src: '',
    width: 0
  };

  constructor() {}

  async getAds(): Promise<Ad> {
    return {
      ...this.defaultAd
    };
  }
}
