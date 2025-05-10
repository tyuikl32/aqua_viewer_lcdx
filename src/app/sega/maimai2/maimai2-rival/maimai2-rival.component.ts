import { Component } from '@angular/core';
import {ApiService} from '../../../api.service';
import {NgbModal} from '@ng-bootstrap/ng-bootstrap';
import {UserService} from '../../../user.service';
import {MessageService} from '../../../message.service';
import {debounce} from '../../../util/debounce';
import {Maimai2Rival} from '../model/Maimai2Rival';
import {HttpParams} from '@angular/common/http';
import {environment} from '../../../../environments/environment';

@Component({
  selector: 'app-maimai2-rival',
  templateUrl: './maimai2-rival.component.html',
  styleUrls: ['./maimai2-rival.component.css']
})
export class Maimai2RivalComponent {

  constructor(
    private api: ApiService,
    private modalService: NgbModal,
    protected userService: UserService,
    private messageService: MessageService,
  ) {
  }

  host = environment.assetsHost;
  rivalList: Maimai2Rival[] = [];
  loading = true;
  addingFriend: boolean;
  private aimeId: string;
  protected readonly String = String;

  ngOnInit(){
    this.loading = true;
    this.aimeId = String(this.userService.currentUser.defaultCard.extId);
    this.loadRival();
  }

  loadRival() {
    const param = new HttpParams().set('aimeId', this.aimeId);
    this.api.get('api/game/maimai2/rival', param).subscribe(
      (data: Maimai2Rival[]) => {
        // Convert rivalIds for display
        this.rivalList = data.map(rival => ({
          ...rival,
          rivalId: this.convertRivalId(rival.rivalId)
        }));
        this.loading = false;
      },
      error => {
        this.messageService.notice(`Cannot get rival list: ${error}`);
      }
    );
  }

  removeRival(displayRivalId: string) {
    // Revert the ID back to original before sending
    const originalRivalId = this.revertRivalId(displayRivalId);
    const param = new HttpParams()
      .set('rivalId', originalRivalId)
      .set('aimeId', this.aimeId);

    this.api.delete('api/game/maimai2/rival', param).subscribe(
      () => {
        const newList = this.rivalList.filter(item => item.rivalId !== displayRivalId);
        this.messageService.notice(`(id:${displayRivalId}) delete successfully.`);
        this.rivalList = newList;
      },
      error => this.messageService.notice(`remove rival failed: ${error}`)
    );
  }

  addRival(displayRivalId: string) {
    this.addingFriend = true;
    const originalRivalId = this.revertRivalId(displayRivalId);
    const param = new HttpParams()
      .set('rivalId', originalRivalId)
      .set('aimeId', this.aimeId);

    this.api.post('api/game/maimai2/rival', param).subscribe(
      data => {
        this.addingFriend = false;
        if (data) {
          this.messageService.notice(`Add rival success!`);
          this.loadRival();
        }
      },
      error => {
        this.messageService.notice(`add rival failed: ${error}`);
        this.addingFriend = false;
      }
    );
  }


  convertRivalId(src: string): string {
    return (59999999 - parseInt(src) + 1234).toString();
  }

  revertRivalId(src: string): string {
    return (-(parseInt(src) - 1234 - 59999999)).toString();
  }
  getFormattedNumberByDigit(input: string, digit: number): string {
    return input.toString().padStart(digit, '0');
  }
}
