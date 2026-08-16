import {NgModule} from '@angular/core';
import {CommonModule} from '@angular/common';
import {ImporterComponent} from './importer/importer.component';
import {FormsModule, ReactiveFormsModule} from '@angular/forms';
import {TranslatePipe, TranslateDirective} from '@ngx-translate/core';

@NgModule({
  declarations: [ImporterComponent],
  imports: [
    CommonModule,
    ReactiveFormsModule,
    FormsModule,
    TranslatePipe,
    TranslateDirective
  ]
})
export class ImporterModule {
}
