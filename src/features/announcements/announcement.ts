/** 等价旧版 announcement.component.ts 的模型与枚举 */

export interface LocalAnnouncement {
  language: string;
  translatedTitle: string;
  translatedContent: string;
}

export enum AnnouncementStatus {
  ACTIVE = 'ACTIVE',
  EXPIRED = 'EXPIRED',
  DRAFT = 'DRAFT',
}

export enum AnnouncementType {
  GENERAL = 'GENERAL',
  MAINTENANCE = 'MAINTENANCE',
  UPDATE = 'UPDATE',
  EVENT = 'EVENT',
  TUTORIAL = 'TUTORIAL',
  OTHER = 'OTHER',
}

interface AnnouncementJSON {
  id: number;
  title?: string | null;
  content?: string | null;
  expirationDate?: string | number | null;
  updatedAt: string | number;
  status: AnnouncementStatus;
  type: AnnouncementType | 'OTHERS';
  priority: number;
  translations?: {
    language: string;
    translatedTitle?: string | null;
    translatedContent?: string | null;
  }[] | null;
}

export class Announcement {
  id!: number;
  title = '';
  content = '';
  expirationDate!: Date;
  updatedAt!: Date;
  status!: AnnouncementStatus;
  type!: AnnouncementType;
  priority!: number;
  translations: LocalAnnouncement[] = [{ language: 'en', translatedTitle: '', translatedContent: '' }];

  static fromJSON(json: AnnouncementJSON): Announcement {
    const announcement = new Announcement();
    announcement.id = json.id;
    announcement.title = typeof json.title === 'string' ? json.title : '';
    // LCDX list rows omit the body; detail/recent may return null if the file is missing.
    announcement.content = typeof json.content === 'string' ? json.content : '';
    announcement.expirationDate = new Date(json.expirationDate ?? NaN);
    announcement.updatedAt = new Date(json.updatedAt);
    announcement.status = json.status;
    announcement.type = json.type === 'OTHERS' ? AnnouncementType.OTHER : json.type;
    announcement.priority = json.priority;
    announcement.translations = Array.isArray(json.translations)
      ? json.translations
          .filter((item) => item && typeof item.language === 'string')
          .map((item) => ({
            language: item.language,
            translatedTitle: typeof item.translatedTitle === 'string' ? item.translatedTitle : '',
            translatedContent: typeof item.translatedContent === 'string' ? item.translatedContent : '',
          }))
      : [];
    return announcement;
  }

  getLocalTitle(lang: string): string {
    const trans = this.translations?.find((t) => t.language === lang);
    return trans?.translatedTitle.trim() ? trans.translatedTitle : this.title;
  }

  getLocalContent(lang: string): string {
    const trans = this.translations?.find((t) => t.language === lang);
    return trans?.translatedContent.trim() ? trans.translatedContent : this.content;
  }
}
