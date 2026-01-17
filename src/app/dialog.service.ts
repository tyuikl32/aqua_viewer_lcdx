import { Injectable } from '@angular/core';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { DialogComponent, DialogCustomModel } from './dialog.component';

@Injectable({ providedIn: 'root' })
export class DialogService {
    constructor(private modalService: NgbModal) { }

    showCustom(customModel: DialogCustomModel): Promise<boolean> {
        if (!customModel.yesContent)
            customModel.yesContent = "确定";
        if (!customModel.noContent)
            customModel.noContent = "取消";
        if (!customModel.yesClass)
            customModel.yesClass = "btn-primary";
        if (!customModel.noClass)
            customModel.noClass = "btn-secondary";

        const modalRef = this.modalService.open(DialogComponent, { centered: true });
        modalRef.componentInstance.customModel = customModel;

        return modalRef.result.catch(() => false);
    }

    show(title: string, message: string): Promise<boolean> {
        return this.showCustom({ title, message, yesClass: null, yesContent: null, noClass: null, noContent: null });
    }
}