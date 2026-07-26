import {NgModule} from '@angular/core';

import {CommonModule} from '@angular/common';
import {DashboardComponent} from './dashboard.component';
import {NgForOf} from '@angular/common';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {TranslatePipe, TranslateDirective } from '@ngx-translate/core';
import {NgIconsModule} from '@ng-icons/core';
import {
  bootstrapBell,
  bootstrapCheckLg,
  bootstrapXLg,
  bootstrapQuestionLg
} from '@ng-icons/bootstrap-icons';
import { AppRoutingModule } from '../app-routing.module';
import { AnnouncementComponent } from '../announcements/announcement/announcement.component';
import { ToolsModule } from '../util/tools.module';
import {V2Module} from '../sega/chunithm/v2/v2.module';

@NgModule({
    exports: [],
    declarations: [DashboardComponent, AnnouncementComponent],
    providers: [],
    imports: [
        AppRoutingModule,
        CommonModule,
        NgForOf,
        FormsModule,
        ReactiveFormsModule,
        TranslatePipe,
        TranslateDirective,
        NgIconsModule.withIcons({
            bootstrapBell,
            bootstrapCheckLg,
            bootstrapXLg,
            bootstrapQuestionLg
        }),
        ToolsModule,
        V2Module
    ]
})
export class DashboardModule {
}
