import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'toDate',
    standalone: false
})
export class ToDatePipe implements PipeTransform {

  transform(value: string): Date {
    return new Date(value);
  }

}
