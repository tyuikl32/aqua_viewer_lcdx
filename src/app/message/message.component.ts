import {Component, Injectable, OnInit, ChangeDetectionStrategy} from '@angular/core';

@Injectable({
  providedIn: 'root'
})
@Component({
    selector: 'app-message',
    templateUrl: './message.component.html',
    styleUrls: ['./message.component.css'],
    changeDetection: ChangeDetectionStrategy.Eager,
    standalone: false
})
export class MessageComponent implements OnInit {


  constructor(
  ) {
  }


  ngOnInit() {}

}
