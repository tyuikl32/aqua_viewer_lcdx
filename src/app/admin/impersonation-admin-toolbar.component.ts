import {Component, OnInit} from '@angular/core';
import {ImpersonationService} from '../auth/impersonation.service';

@Component({selector: 'app-impersonation-admin-toolbar', templateUrl: './impersonation-admin-toolbar.component.html',
  styleUrls: ['./impersonation-admin-toolbar.component.css'], standalone: false})
export class ImpersonationAdminToolbarComponent implements OnInit {
  data: any;
  extId = '';
  externalLuid = '';
  game = 'CHUSAN';
  status = 0;
  message = '';
  constructor(public impersonation: ImpersonationService) {}
  ngOnInit() { this.refresh(); }
  run(action: any, payload: any) {
    this.impersonation.requestAdminAction(action, payload).then(data => {
      this.message = '操作成功';
      if (data?.account) this.data = data;
      else this.refresh();
    }).catch(error => this.message = error.message);
  }
  refresh() { this.run('refresh-admin-context', {}); }
}
