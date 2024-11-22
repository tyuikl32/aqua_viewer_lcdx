import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'toTechRating'
})
export class ToTechRatingPipe implements PipeTransform {

  transform(score: number, chartConstant: number): number {
    const C = chartConstant;
    const S = score;

    let result;

    if (S >= 1009000) {
      result = C + 215;
    } else if (S >= 1007500) {
      result = Math.floor(((S - 1007500) * 15) / 1500 + (C + 200));
    } else if (S >= 1005000) {
      result = Math.floor(((S - 1005000) * 50) / 2500 + (C + 150));
    } else if (S >= 1000000) {
      result = Math.floor(((S - 1000000) * 50) / 5000 + (C + 100));
    } else if (S >= 975000) {
      result = Math.floor(((S - 975000) * 100) / 25000 + C);
    } else if (S >= 925000) {
      result = Math.floor(((S - 925000) * 300) / 50000 + (C - 300));
    } else if (S >= 900000) {
      result = Math.floor(((S - 900000) * 200) / 25000 + (C - 500));
    } else if (S >= 800000) {
      const deltaR = Math.floor((C - 500) / 2);
      result = Math.floor(((S - 800000) * deltaR) / 100000 + deltaR);
    } else if (S >= 500000) {
      const deltaR = Math.floor((C - 500) / 2);
      result = Math.floor(((S - 500000) * deltaR) / 300000);
    } else {
      result = 0;
    }

    if (result < 0){
      result = 0;
    }

    return result;
  }

}
