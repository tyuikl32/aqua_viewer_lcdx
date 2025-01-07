import {NgModule} from '@angular/core';
import {DBConfig, NgxIndexedDBModule} from 'ngx-indexed-db';

export function migrationFactory() {
  return {
    3: (db: IDBDatabase, transaction: IDBTransaction) => {
      db.deleteObjectStore('divaPv');
      db.deleteObjectStore('divaModule');
      db.deleteObjectStore('divaCustomize');
      db.deleteObjectStore('chuniMusic');
      db.deleteObjectStore('chuniCharacter');
      db.deleteObjectStore('chuniSkill');
      const ongekiTrophyStore = db.createObjectStore('ongekiTrophy', {keyPath: 'id', autoIncrement: false});
      ongekiTrophyStore.createIndex('name', 'name', {unique: false});
      ongekiTrophyStore.createIndex('rarityType', 'rarityType', {unique: false});
    },
    4: (db: IDBDatabase, transaction: IDBTransaction) => {
      const maimai2MusicStore = db.createObjectStore('maimai2Music', {keyPath: 'musicId', autoIncrement: false});
      maimai2MusicStore.createIndex('name', 'name', {unique: false});
      maimai2MusicStore.createIndex('sortName', 'sortName', {unique: false});
      maimai2MusicStore.createIndex('artistName', 'artistName', {unique: false});
      maimai2MusicStore.createIndex('genreId', 'genreId', {unique: false});
      maimai2MusicStore.createIndex('romVersion', 'romVersion', {unique: false});
      maimai2MusicStore.createIndex('addVersion', 'addVersion', {unique: false});
    },
    5: (db: IDBDatabase, transaction: IDBTransaction) => {
      const chusanSymbolChatStore = db.createObjectStore('chusanSymbolChat', {keyPath: 'id', autoIncrement: false});
      chusanSymbolChatStore.createIndex('name', 'name', {unique: false});
      chusanSymbolChatStore.createIndex('sortName', 'sortName', {unique: false});
      chusanSymbolChatStore.createIndex('text', 'text', {unique: false});
      chusanSymbolChatStore.createIndex('balloonId', 'balloonId', {unique: false});
      chusanSymbolChatStore.createIndex('sceneIds', 'sceneIds', {unique: false});
    },
  };
}
const dbConfig: DBConfig = {
  name: 'Aqua',
  version: 5,
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
