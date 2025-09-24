import { Component, Input } from '@angular/core';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';

export interface DialogCustomModel {
  title: string;
  message: string;
  yesContent: string;
  noContent: string;
  yesClass: string;
  noClass: string;
}

@Component({
  selector: 'app-dialog',
  template: `
    <div class="modal-header">
      <h4 class="modal-title">{{ customModel.title }}</h4>
    </div>
    <div class="modal-body">
      <ng-container>
        <p>{{ customModel.message }}</p>
      </ng-container>

      <ng-content></ng-content>
    </div>
    <div class="modal-footer">
      <button class="btn {{customModel.yesClass}}" (click)="activeModal.close(true)">{{customModel.yesContent}}</button>
      <button class="btn {{customModel.noClass}}" (click)="activeModal.close(false)">{{customModel.noContent}}</button>
    </div>
  `
})
export class DialogComponent {
  customModel: DialogCustomModel = null;
  constructor(public activeModal: NgbActiveModal) { }
}