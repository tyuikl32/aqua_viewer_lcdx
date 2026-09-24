import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@/styles/globals.css';
import App from './app';
import { translate } from '@/lib/i18n';
import { installTheme } from '@/lib/theme';
import { bootstrapImpersonation } from '@/lib/auth/impersonation';

installTheme();

async function start() {
  const bootstrapResult = await bootstrapImpersonation();
  if (bootstrapResult === 'redirecting') return;
  if (bootstrapResult === 'failed') {
    const root = document.getElementById('root');
    if (root) root.textContent = translate('Common.ImpersonationFailed');
    return;
  }

  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
}

void start();
