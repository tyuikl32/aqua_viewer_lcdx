import {MessageComponent} from './message/message.component';
import {Injectable} from '@angular/core';
import {TranslateService} from '@ngx-translate/core';
import {ToastService} from "./toast-service";

@Injectable({
  providedIn: 'root'
})
export class MessageService {
  constructor(private messageComponent: MessageComponent,
              private translate: TranslateService,
              public toastService: ToastService) {
  }

  notice(message: string, color: 'danger' | 'warning' | 'success' = null) {
    if(color === 'danger'){
      this.toastService.show(message, {classname: 'text-bg-danger'});
    }
    else if(color === 'warning'){
      this.toastService.show(message, {classname: 'text-bg-warning'});
    }
    else if(color === 'success'){
      this.toastService.show(message, {classname: 'text-bg-success'});
    }
    else{
      this.toastService.show(message);
    }
    // this.messageComponent.openSnackBar(message);
  }

  /// 本地化提示。所有用户可见文案都必须通过 i18n key 走这里；
  /// 禁止把后端 status.message 或 HttpErrorResponse 对象直接传给 notice()。
  noticeTranslated(key: string, color: 'danger' | 'warning' | 'success' = null, params?: object) {
    this.notice(this.translate.instant(key, params), color);
  }

  /// 通用失败提示，用于无法判断具体语义的错误回调（原生的 error/err 对象透传）。
  noticeError(color: 'danger' | 'warning' | 'success' = null) {
    this.noticeTranslated('Common.OperationFailed', color);
  }
}
