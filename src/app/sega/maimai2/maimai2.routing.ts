import { RouterModule, Routes } from '@angular/router';
import { Maimai2ProfileComponent } from './maimai2-profile/maimai2-profile.component';
import { Maimai2SettingComponent } from './maimai2-setting/maimai2-setting.component';
import { Maimai2RatingComponent } from './maimai2-rating/maimai2-rating.component';
import { Maimai2RecentComponent } from './maimai2-recent/maimai2-recent.component';
import { Maimai2PhotosComponent } from './maimai2-photos/maimai2-photos.component';
import { Maimai2DxpassComponent } from './maimai2-dxpass/maimai2-dxpass.component';
import { Maimai2SonglistComponent } from './maimai2-songlist/maimai2-songlist.component';
import { Maimai2RivalComponent } from './maimai2-rival/maimai2-rival.component';
import { Maimai2CircleComponent } from './maimai2-circle/maimai2-circle.component';
import { Maimai2FestaComponent } from './maimai2-festa/maimai2-festa.component';


const routes: Routes = [
  { path: 'profile', component: Maimai2ProfileComponent, data: { title: 'Profile' } },
  { path: 'setting', component: Maimai2SettingComponent, data: { title: 'Settings' } },
  { path: 'recent', component: Maimai2RecentComponent, data: { title: 'Recent' } },
  { path: 'rating', component: Maimai2RatingComponent, data: { title: 'Rating' } },
  { path: 'photos', component: Maimai2PhotosComponent, data: { title: 'Photos' } },
  { path: 'dxpass', component: Maimai2DxpassComponent, data: { title: 'DxPass' } },
  { path: 'circle', component: Maimai2CircleComponent, data: { title: 'Circle' } },
  { path: 'festa', component: Maimai2FestaComponent, data: { title: 'Festa' } },
  { path: 'songlist', component: Maimai2SonglistComponent, data: { title: 'Songlist' } },
  { path: 'rival', component: Maimai2RivalComponent, data: { title: 'Rival' } },
];

export const Maimai2Routes = RouterModule.forChild(routes);
