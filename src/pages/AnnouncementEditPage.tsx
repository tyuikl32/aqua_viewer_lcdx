import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { BModal } from '@/components/shared/BModal';
import { Announcement, AnnouncementStatus, AnnouncementType } from '@/features/announcements/announcement';
import { api } from '@/lib/api/client';
import { languages } from '@/lib/i18n';
import { notice } from '@/lib/message';
import { StatusCode } from '@/lib/models';
import '@/features/announcements/AnnouncementDialog.css';
import './AnnouncementEditPage.css';

/** Equivalent to the legacy announcement editor. */
export function AnnouncementEditPage() {
  const { t } = useTranslation();
  const [searchParams] = useSearchParams();
  const [announcement, setAnnouncement] = useState<Announcement | null>(null);
  const [activeTab, setActiveTab] = useState('zh');
  const [previewOpen, setPreviewOpen] = useState(false);
  const id = Number(searchParams.get('id')) || 0;

  useEffect(() => {
    if (!id) {
      const value = new Announcement();
      value.type = AnnouncementType.GENERAL;
      value.priority = 0;
      setAnnouncement(value);
      return;
    }
    void api
      .get(`api/admin/announcement/${id}`)
      .then((response) => {
        if (response?.status?.code === StatusCode.OK && response.data) {
          setAnnouncement(Announcement.fromJSON(response.data));
        } else {
          notice(t('AnnouncementsPage.Edit.LoadFailed'));
        }
      })
      .catch(() => notice(t('Common.OperationFailed')));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const updateAnnouncement = (apply: (draft: Announcement) => void) => {
    setAnnouncement((current) => {
      if (!current) return current;
      const next = Object.assign(new Announcement(), current);
      next.translations = current.translations.map((translation) => ({ ...translation }));
      apply(next);
      return next;
    });
  };

  const post = async (status: AnnouncementStatus) => {
    if (!announcement) return;
    const data: Record<string, unknown> = announcement.id === undefined
      ? {
          title: announcement.title,
          content: announcement.content,
          translations: announcement.translations,
          type: announcement.type,
          status,
          updatedAt: Date.now(),
          priority: announcement.priority,
        }
      : { ...announcement, status };
    if (status === AnnouncementStatus.EXPIRED || status === AnnouncementStatus.DRAFT) {
      data.updatedAt = announcement.updatedAt;
    }
    try {
      const response = await api.post('api/admin/announcement', data);
      if (response?.status?.code === StatusCode.OK) {
        notice(t('AnnouncementsPage.Edit.SaveSuccess'), 'success');
      } else {
        notice(t('AnnouncementsPage.Edit.SaveFailed'));
      }
    } catch {
      notice(t('Common.OperationFailed'));
    }
  };

  const previewTitle = announcement?.getLocalTitle(activeTab) ?? '';
  const previewContent = announcement?.getLocalContent(activeTab) ?? '';

  return (
    <div className="content announcement-edit-page">
      <h1 className="page-heading">{t('AnnouncementsPage.DraftNew')}</h1>
      {announcement && (
        <>
          <ul className="nav nav-tabs mb-3" id="myTab" role="tablist">
            <li className="nav-item" role="presentation">
              <button
                className={`nav-link${activeTab === 'zh' ? ' active' : ''}`}
                id="zh-tab"
                type="button"
                role="tab"
                aria-selected={activeTab === 'zh'}
                onClick={() => setActiveTab('zh')}
              >
                {languages.get('zh')}
              </button>
            </li>
            {announcement.translations.map((translation) => (
              <li className="nav-item" role="presentation" key={translation.language}>
                <button
                  className={`nav-link${activeTab === translation.language ? ' active' : ''}`}
                  id={`${translation.language}-tab`}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === translation.language}
                  onClick={() => setActiveTab(translation.language)}
                >
                  {languages.get(translation.language)}
                </button>
              </li>
            ))}
          </ul>

          <div className="tab-content" id="myTabContent">
            <div
              className={`tab-pane${activeTab === 'zh' ? ' show active' : ''}`}
              id="zh-tab-pane"
              role="tabpanel"
              aria-labelledby="zh-tab"
              tabIndex={0}
            >
              <input
                className="form-control mb-3"
                placeholder={t('AnnouncementsPage.Edit.TitlePlaceholder')}
                value={announcement.title}
                onChange={(event) => updateAnnouncement((draft) => { draft.title = event.target.value; })}
              />
              <textarea
                className="form-control announcement-content mb-3"
                placeholder={t('AnnouncementsPage.Edit.ContentPlaceholder')}
                value={announcement.content}
                onChange={(event) => updateAnnouncement((draft) => { draft.content = event.target.value; })}
              />
            </div>
            {announcement.translations.map((translation) => (
              <div
                className={`tab-pane${activeTab === translation.language ? ' show active' : ''}`}
                id={`${translation.language}-tab-pane`}
                role="tabpanel"
                aria-labelledby={`${translation.language}-tab`}
                tabIndex={0}
                key={translation.language}
              >
                <input
                  className="form-control mb-3"
                  placeholder={t('AnnouncementsPage.Edit.TitlePlaceholder')}
                  value={translation.translatedTitle}
                  onChange={(event) => updateAnnouncement((draft) => {
                    const target = draft.translations.find((item) => item.language === translation.language);
                    if (target) target.translatedTitle = event.target.value;
                  })}
                />
                <textarea
                  className="form-control announcement-content mb-3"
                  placeholder={t('AnnouncementsPage.Edit.ContentPlaceholder')}
                  value={translation.translatedContent}
                  onChange={(event) => updateAnnouncement((draft) => {
                    const target = draft.translations.find((item) => item.language === translation.language);
                    if (target) target.translatedContent = event.target.value;
                  })}
                />
              </div>
            ))}

            <select
              className="form-select mb-3"
              value={announcement.type}
              onChange={(event) => updateAnnouncement((draft) => { draft.type = event.target.value as AnnouncementType; })}
            >
              <option value={AnnouncementType.GENERAL}>{t('AnnouncementsPage.General')}</option>
              <option value={AnnouncementType.MAINTENANCE}>{t('AnnouncementsPage.Maintenance')}</option>
              <option value={AnnouncementType.UPDATE}>{t('AnnouncementsPage.Update')}</option>
              <option value={AnnouncementType.EVENT}>{t('AnnouncementsPage.Event')}</option>
              <option value={AnnouncementType.TUTORIAL}>{t('AnnouncementsPage.Tutorial')}</option>
              <option value={AnnouncementType.OTHER}>{t('AnnouncementsPage.Other')}</option>
            </select>
            <select
              className="form-select mb-3"
              value={announcement.priority}
              onChange={(event) => updateAnnouncement((draft) => { draft.priority = Number(event.target.value); })}
            >
              <option value={0}>{t('AnnouncementsPage.NotPinned')}</option>
              <option value={1}>{t('AnnouncementsPage.Important')}</option>
              <option value={2}>{t('AnnouncementsPage.Pinned')}</option>
            </select>
            <div className="d-flex gap-2 mb-3">
              <button className="btn btn-primary btn-sm" onClick={() => setPreviewOpen(true)}>{t('AnnouncementsPage.QuickPreview')}</button>
              <button className="btn btn-primary btn-sm" onClick={() => void post(AnnouncementStatus.DRAFT)}>{t('AnnouncementsPage.SaveDraft')}</button>
              <button className="btn btn-primary btn-sm" onClick={() => void post(AnnouncementStatus.ACTIVE)}>{t('AnnouncementsPage.Publish')}</button>
              <button className="btn btn-danger btn-sm" onClick={() => void post(AnnouncementStatus.EXPIRED)}>{t('AnnouncementsPage.SetExpired')}</button>
            </div>
          </div>
        </>
      )}

      <BModal
        className="announcement-detail-dialog"
        open={previewOpen}
        onClose={() => setPreviewOpen(false)}
        scrollable
      >
        <div
          className="announcement-content"
          aria-label={previewTitle}
          dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(previewContent) as string) }}
        />
      </BModal>
    </div>
  );
}
