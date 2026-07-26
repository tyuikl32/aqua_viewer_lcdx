import {NgModule} from '@angular/core';
import {DBConfig, NgxIndexedDBModule} from 'ngx-indexed-db';

// ngx-indexed-db creates every store listed in objectStoresMeta BEFORE running these
// migrations, so a migration must never create a store that is also declared there:
// createObjectStore would throw ConstraintError and abort the whole upgrade transaction,
// leaving the database at its old version with none of the new stores.
// Stores added from now on only need an objectStoresMeta entry plus a version bump.
export function migrationFactory() {
  return {
    3: (db: IDBDatabase, transaction: IDBTransaction) => {
      ['divaPv', 'divaModule', 'divaCustomize', 'chuniMusic', 'chuniCharacter', 'chuniSkill']
        .filter(store => db.objectStoreNames.contains(store))
        .forEach(store => db.deleteObjectStore(store));
    },
    4: (db: IDBDatabase, transaction: IDBTransaction) => {
    },
    5: (db: IDBDatabase, transaction: IDBTransaction) => {
    },
  };
}
const dbConfig: DBConfig = {
  name: 'Aqua',
  version: 6,
  objectStoresMeta: [
    {
      store: 'ongekiCard',
      storeConfig: {keyPath: 'id', autoIncrement: false},
      storeSchema: [
        {name: 'name', keypath: 'name', options: {unique: false}},
        {name: 'nickName', keypath: 'nickName', options: {unique: false}},
        {name: 'attribute', keypath: 'attribute', options: {unique: false}},
        {name: 'charaId', keypath: 'charaId', options: {unique: false}},
        {name: 'school', keypath: 'school', options: {unique: false}},
        {name: 'gakuen', keypath: 'gakuen', options: {unique: false}},
        {name: 'rarity', keypath: 'rarity', options: {unique: false}},
        {name: 'levelParam', keypath: 'levelParam', options: {unique: false}},
        {name: 'skillId', keypath: 'skillId', options: {unique: false}},
        {name: 'chouKaikaSkillId', keypath: 'chouKaikaSkillId', options: {unique: false}},
        {name: 'cardNumber', keypath: 'cardNumber', options: {unique: false}},
        {name: 'version', keypath: 'version', options: {unique: false}},
      ]
    }, {
      store: 'ongekiCharacter',
      storeConfig: {keyPath: 'id', autoIncrement: false},
      storeSchema: [
        {name: 'name', keypath: 'name', options: {unique: false}},
        {name: 'cv', keypath: 'cv', options: {unique: false}},
        {name: 'modelId', keypath: 'modelId', options: {unique: false}}
      ]
    }, {
      store: 'ongekiMusic',
      storeConfig: {keyPath: 'id', autoIncrement: false},
      storeSchema: [
        {name: 'name', keypath: 'name', options: {unique: false}},
        {name: 'sortName', keypath: 'sortName', options: {unique: false}},
        {name: 'artistName', keypath: 'artistName', options: {unique: false}},
        {name: 'genre', keypath: 'genre', options: {unique: false}},
        {name: 'bossCardId', keypath: 'bossCardId', options: {unique: false}},
        {name: 'bossLevel', keypath: 'bossLevel', options: {unique: false}},
        {name: 'level0', keypath: 'level0', options: {unique: false}},
        {name: 'level1', keypath: 'level1', options: {unique: false}},
        {name: 'level2', keypath: 'level2', options: {unique: false}},
        {name: 'level3', keypath: 'level3', options: {unique: false}},
        {name: 'level4', keypath: 'level4', options: {unique: false}}
      ]
    }, {
      store: 'ongekiSkill',
      storeConfig: {keyPath: 'id', autoIncrement: false},
      storeSchema: [
        {name: 'name', keypath: 'name', options: {unique: false}},
        {name: 'sortName', keypath: 'sortName', options: {unique: false}},
        {name: 'category', keypath: 'category', options: {unique: false}},
        {name: 'info', keypath: 'info', options: {unique: false}}
      ]
    }, {
      store: 'ongekiTrophy',
      storeConfig: {keyPath: 'id', autoIncrement: false},
      storeSchema: [
        {name: 'name', keypath: 'name', options: {unique: false}},
        {name: 'rarityType', keypath: 'rarityType', options: {unique: false}},
      ]
    }, {
      store: 'chusanMusic',
      storeConfig: {keyPath: 'musicId', autoIncrement: false},
      storeSchema: [
        {name: 'name', keypath: 'name', options: {unique: false}},
        {name: 'sortName', keypath: 'sotrName', options: {unique: false}},
        {name: 'artistName', keypath: 'artistName', options: {unique: false}},
        {name: 'genre', keypath: 'genre', options: {unique: false}},
        {name: 'releaseVersion', keypath: 'releaseVersion', options: {unique: false}}
      ]
    }, {
      store: 'chusanCharacter',
      storeConfig: {keyPath: 'id', autoIncrement: false},
      storeSchema: [
        {name: 'name', keypath: 'name', options: {unique: false}},
        {name: 'releaseTag', keypath: 'releaseTag', options: {unique: false}},
        {name: 'worksName', keypath: 'worksName', options: {unique: false}},
        {name: 'illustratorName', keypath: 'illustratorName', options: {unique: false}},
        {name: 'addImages', keypath: 'addImages', options: {unique: false}}
      ]
    }, {
      store: 'chusanTrophy',
      storeConfig: {keyPath: 'id', autoIncrement: false},
      storeSchema: [
        {name: 'name', keypath: 'name', options: {unique: false}}
      ]
    }, {
      store: 'chusanNamePlate',
      storeConfig: {keyPath: 'id', autoIncrement: false},
      storeSchema: [
        {name: 'name', keypath: 'name', options: {unique: false}}
      ]
    }, {
      store: 'chusanSystemVoice',
      storeConfig: {keyPath: 'id', autoIncrement: false},
      storeSchema: [
        {name: 'name', keypath: 'name', options: {unique: false}}
      ]
    }, {
      store: 'chusanStage',
      storeConfig: {keyPath: 'id', autoIncrement: false},
      storeSchema: [
        {name: 'name', keypath: 'name', options: {unique: false}}
      ]
    }, {
      store: 'chusanMapIcon',
      storeConfig: {keyPath: 'id', autoIncrement: false},
      storeSchema: [
        {name: 'name', keypath: 'name', options: {unique: false}}
      ]
    }, {
      store: 'chusanFrame',
      storeConfig: {keyPath: 'id', autoIncrement: false},
      storeSchema: [
        {name: 'name', keypath: 'name', options: {unique: false}}
      ]
    }, {
      store: 'chusanAvatarAcc',
      storeConfig: {keyPath: 'id', autoIncrement: false},
      storeSchema: [
        {name: 'name', keypath: 'name', options: {unique: false}},
        {name: 'category', keypath: 'category', options: {unique: false}}
      ]
    }, {
      store: 'chusanSymbolChat',
      storeConfig: {keyPath: 'id', autoIncrement: false},
      storeSchema: [
        {name: 'name', keypath: 'name', options: {unique: false}},
        {name: 'sortName', keypath: 'sortName', options: {unique: false}},
        {name: 'text', keypath: 'text', options: {unique: false}},
        {name: 'balloonId', keypath: 'balloonId', options: {unique: false}},
        {name: 'sceneIds', keypath: 'sceneIds', options: {unique: false}}
      ]
    }, {
     store: 'maimai2Music',
      storeConfig: {keyPath: 'musicId', autoIncrement: false},
      storeSchema: [
        {name: 'musicId', keypath: 'musicId', options: {unique: false}},
        {name: 'name', keypath: 'name', options: {unique: false}},
        {name: 'sortName', keypath: 'sortName', options: {unique: false}},
        {name: 'artistName', keypath: 'artistName', options: {unique: false}},
        {name: 'genreId', keypath: 'genreId', options: {unique: false}},
        {name: 'romVersion', keypath: 'romVersion', options: {unique: false}},
        {name: 'addVersion', keypath: 'addVersion', options: {unique: false}},
      ]
    }
  ],
  migrationFactory
};

@NgModule({
  declarations: [],
  imports: [
    NgxIndexedDBModule.forRoot(dbConfig)
  ]
})
export class DatabaseModule {
}
