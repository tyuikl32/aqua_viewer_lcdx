import { marked } from 'marked';
import DOMPurify from 'dompurify';
import { useTranslation } from 'react-i18next';

/** Shared by the list and dashboard; missing LCDX files are not a route-level error. */
export function AnnouncementContent({ content }: { content: string }) {
  const { t } = useTranslation();
  if (!content.trim()) {
    return (
      <div className="announcement-content text-secondary">
        {t('AnnouncementsPage.ContentUnavailable')}
      </div>
    );
  }
  return (
    <div
      className="announcement-content"
      dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(marked.parse(content, { async: false })) }}
    />
  );
}
