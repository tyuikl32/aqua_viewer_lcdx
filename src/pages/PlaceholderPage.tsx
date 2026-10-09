import { useTranslation } from 'react-i18next';
import { Skeleton } from '@/components/ui/skeleton';

/** 迁移过渡用占位页（M2+ 逐页替换） */
export function PlaceholderPage({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <div className="content">
      <h1 className="page-heading">{title}</h1>
      <p className="text-body-secondary">{t('Common.PageNotMigrated')}</p>
      <Skeleton className="h-8 w-3/4" />
    </div>
  );
}
