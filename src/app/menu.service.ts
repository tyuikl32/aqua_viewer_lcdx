import { Injectable } from '@angular/core';
import { User } from './user.service';
import { AccountService } from './auth/account.service';

@Injectable({
  providedIn: 'root'
})
export class MenuService {
  public menu = new Map<string, Menu[]>(
    [
      [
        'maimai2',
        [
          {
            id: 0,
            name: 'Profile',
            url: 'mai2/profile',
            displayCondition: DisplayCondition.HasProfile,
          },
          {
            id: 2,
            name: 'Rating',
            url: 'mai2/rating',
            displayCondition: DisplayCondition.HasProfile,
          },
          {
            id: 3,
            name: 'PlayRecord',
            url: 'mai2/recent',
            displayCondition: DisplayCondition.HasProfile,
          },
          {
            id: 6,
            name: 'KOP',
            url: 'mai2/kop',
            displayCondition: DisplayCondition.HasProfile,
          },
          {
            id: 4,
            name: 'Photos',
            url: 'mai2/photos',
            displayCondition: DisplayCondition.HasProfile,
          },
          {
            id: 5,
            name: 'Dxpass',
            url: 'mai2/dxpass',
            displayCondition: DisplayCondition.HasProfile,
          },
          {
            id: 7,
            name: 'Rival',
            url: 'mai2/rival',
            displayCondition: DisplayCondition.HasProfile,
          },
          {
            id: 6,
            name: 'MusicList',
            url: 'mai2/songlist',
            displayCondition: DisplayCondition.Always,
          },
          {
            id: 1,
            name: 'Setting',
            url: 'mai2/setting',
            displayCondition: DisplayCondition.HasProfile,
          }
        ]
      ]
    ]
  );

  constructor(
    private accountService: AccountService
  ) { }

  public showItem(game: string, item: Menu, user: User): boolean{
    if(item.displayCondition == DisplayCondition.Always){
      return true;
    }
    else if(item.displayCondition == DisplayCondition.AfterLogin && this.accountService.currentAccountValue){
      return true;
    }
    else if(item.displayCondition == DisplayCondition.HasProfile && user?.games.includes(game)){
      return true;
    }
    else if(item.displayCondition == DisplayCondition.IsAdmin && user?.roles.some(r => r.name === 'ROLE_ADMIN')){
      return true;
    }
    else{
      return false;
    }
  }

  public showMenu(game: string, user: User): boolean{
    return this.menu.get(game).some(item => this.showItem(game, item, user))
  }
}

export class Menu {
  id: number;
  name: string;
  url: string;
  displayCondition: DisplayCondition;
}

export enum DisplayCondition {
  Always = 1,
  AfterLogin = 2,
  HasProfile = 4,
  IsAdmin = 8
}
