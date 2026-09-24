import { useCallback, useRef } from 'react';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';
import { LiquidButton, LiquidDialog, LiquefyProvider } from '@liquefy-ui/react';
import { Button as AnimalButton, Modal as AnimalModal } from 'animal-island-ui';
import { Dialog, DialogContent, DialogFooter, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/lib/theme';

/** 等价旧版 dialog.service.ts / dialog.component.ts：全局 yes/no 确认框（默认 确定/取消） */

interface ConfirmOptions {
  title?: string;
  message: string;
  yesText?: string;
  noText?: string;
}

let container: HTMLDivElement | null = null;

export function confirm(options: ConfirmOptions | string): Promise<boolean> {
  const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
  return new Promise((resolve) => {
    if (!container) {
      container = document.createElement('div');
      document.body.appendChild(container);
    }
    const root = createRoot(container);

    const cleanup = (result: boolean) => {
      root.unmount();
      resolve(result);
    };

    root.render(<ConfirmDialogRoot opts={opts} onDone={cleanup} />);
  });
}

function ConfirmDialogRoot({
  opts,
  onDone,
}: {
  opts: ConfirmOptions;
  onDone: (result: boolean) => void;
}) {
  const theme = useTheme();
  const { t } = useTranslation();
  const completed = useRef(false);
  const finish = useCallback(
    (result: boolean) => {
      if (completed.current) return;
      completed.current = true;
      onDone(result);
    },
    [onDone],
  );

  if (theme.family === 'liquefy') {
    const tint = theme.resolvedColorTheme === 'dark' ? '#7abcf3' : '#087f8c';

    return (
      <LiquefyProvider
        theme={theme.resolvedColorTheme}
        tint={tint}
        intensity={0.76}
        lens
        motion
        transparency
        webgl={false}
        wobbliness={0.24}
      >
        <LiquidDialog
          open
          onOpenChange={(nextOpen) => {
            if (!nextOpen) finish(false);
          }}
          onPointerDown={(event) => event.stopPropagation()}
          title={opts.title ?? t('Common.ConfirmTitle')}
          className="liquefy-confirm-dialog"
        >
          <p>{opts.message}</p>
          <div className="mt-5 flex justify-end gap-2">
            <LiquidButton onClick={() => finish(false)}>{opts.noText ?? t('Common.Cancel')}</LiquidButton>
            <LiquidButton tint={tint} onClick={() => finish(true)}>
              {opts.yesText ?? t('Common.OK')}
            </LiquidButton>
          </div>
        </LiquidDialog>
      </LiquefyProvider>
    );
  }

  if (theme.family === 'animal-island') {
    return (
      <AnimalModal
        open
        onClose={() => finish(false)}
        title={opts.title ?? t('Common.ConfirmTitle')}
        width="min(460px, calc(100vw - 2rem))"
        typewriter={false}
        className="animal-island-confirm-dialog"
        footer={
          <div className="flex justify-end gap-3">
            <AnimalButton type="default" onClick={() => finish(false)}>
              {opts.noText ?? t('Common.Cancel')}
            </AnimalButton>
            <AnimalButton type="primary" onClick={() => finish(true)}>
              {opts.yesText ?? t('Common.OK')}
            </AnimalButton>
          </div>
        }
      >
        <p>{opts.message}</p>
      </AnimalModal>
    );
  }

  return (
    <Dialog
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) finish(false);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogTitle>{opts.title ?? t('Common.ConfirmTitle')}</DialogTitle>
        <p className="text-[var(--bs-body-color)]">{opts.message}</p>
        <DialogFooter>
          <Button variant="outline" onClick={() => finish(false)}>
            {opts.noText ?? t('Common.Cancel')}
          </Button>
          <Button onClick={() => finish(true)}>{opts.yesText ?? t('Common.OK')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
