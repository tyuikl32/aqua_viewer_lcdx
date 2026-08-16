import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
    name: 'characterImage',
    standalone: false
})
export class CharacterImagePipe implements PipeTransform {

  transform(characterId: number | string): string {
    const id = Number(characterId);
    const prefix = Math.floor(id / 10).toString().padStart(4, '0');
    const suffix = (id % 10).toString().padStart(2, '0');
    return `${prefix}_${suffix}`;
  }

}
