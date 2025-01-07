import {Component, OnInit} from '@angular/core';
import {ApiService} from '../api.service';
import {Router} from '@angular/router';
import {FormBuilder, FormGroup} from '@angular/forms';
import {AccountService} from '../auth/account.service';
import {HttpClient, HttpParams} from '@angular/common/http';
import {UserService} from '../user.service';
import {MessageService} from '../message.service';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {Luid} from '../cards/cards.component';

@Component({
  selector: 'app-netcode-bind',
  templateUrl: './netcode-bind.component.html',
  styleUrls: ['./netcode-bind.component.css']
})
export class NetcodeBindComponent implements OnInit {

  netCodeForm: FormGroup;
  loaded = false;
  anyCard = false;

  constructor(
    private api: ApiService,
    private fb: FormBuilder,
    private userService: UserService,
    protected router: Router,
    private messageService: MessageService,
  ) {
    this.netCodeForm = this.fb.group({
      netCode: [''],
    });
  }

  ngOnInit(): void {
    this.loadCards();
  }

  loadCards() {
    this.userService.load().then(resp => {
      const user = this.userService.currentUser;
      if (user.cards.length > 0){
        this.anyCard = true;
        this.routeBack();
      }
      this.loaded = true;
    });
  }

  routeBack(){
    this.router.navigate(['/dashboard']);
  }

  onSubmit(){
  }

  get netCodeInput(){
    return this.netCodeForm.get('netCode');
  }

  onClick(){
    if (this.netCodeForm.touched) {
      this.loaded = false;
      this.api.getLcdx('lcdx/bind/' + this.userService.currentUser.username + '/' + this.netCodeInput.value).subscribe(
        resp => {
          this.loaded = true;
          this.messageService.notice(resp.status.message);
          if (resp.status.code === 92001){
            this.routeBack();
          }
        }, error => {this.messageService.notice(error);      this.loaded = true; }
      );
    }

  }
}
