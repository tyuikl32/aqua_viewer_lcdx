import { useEffect, type ReactNode } from 'react';
import { RouterProvider } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { registerSW } from 'virtual:pwa-register';
import { LiquefyProvider } from '@liquefy-ui/react';
import { router } from '@/router';
import { TooltipProvider } from '@/components/ui/tooltip';
import { navigate } from '@/lib/nav';
import { getAccount } from '@/lib/auth/account';
import { restoreAccess } from '@/lib/auth/access';
import { loadUser } from '@/lib/user';
import { checkDbUpdate } from '@/lib/db/preload';
import { notice } from '@/lib/message';
import { t } from 'i18next';
import supportedBrowsers from '@/lib/supportedBrowsers';
import { useTheme } from '@/lib/theme';
import '@/lib/i18n';

const queryClient = new QueryClient();
let initializationPromise: Promise<void> | null = null;

/**
 * 等价旧版 AppComponent 构造器/ngOnInit 的一次性启动逻辑。
 *
 * 必须幂等且可重入。登录成功走的是 SPA 内导航（SignInPage → navigate('/dashboard')），
 * App 组件不会重新挂载，本函数不会再被 App 的 useEffect 触发。因此：
 *   ① 未登录时不得把「空初始化」缓存进 initializationPromise；
 *   ② 失败时同样不缓存，允许后续重试。
 * 否则「未登录进入页面 → 之后在 SPA 内登录」这条路径下 checkDbUpdate() 将永不执行，
 * dashboard 的「游戏数据」卡片会永久停在「检查更新」且无法自愈。
 * 详见 .trellis/tasks/10-12-preload-resilience。
 */
function initializeApp(): Promise<void> {
  if (!getAccount()) {
    initializationPromise = null;
    return Promise.resolve();
  }
  if (!initializationPromise) {
    initializationPromise = (async () => {
      const status = await restoreAccess();
      if (status?.banned) {
        navigate('/banned');
        return;
      }
      void checkDbUpdate();
      await loadUser();
    })().catch(() => {
      initializationPromise = null;
    });
  }
  return initializationPromise;
}

function ThemeRuntime({ children }: { children: ReactNode }) {
  const theme = useTheme();

  if (theme.family !== 'liquefy') return children;

  const tint = theme.resolvedColorTheme === 'dark' ? '#7abcf3' : '#087f8c';

  return (
    <LiquefyProvider
      className="liquefy-app"
      theme={theme.resolvedColorTheme}
      tint={tint}
      intensity={0.76}
      lens
      motion
      transparency
      webgl={false}
      wobbliness={0.24}
    >
      {children}
    </LiquefyProvider>
  );
}

export default function App() {
  useEffect(() => {
    // SW 静默自动更新（等价旧版 VERSION_READY → activateUpdate → reload）
    registerSW();
    void initializeApp();
    if (!supportedBrowsers.test(navigator.userAgent)) {
      notice(t('App.Messages.BrowserNotSupported'), 'warning');
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeRuntime>
        <TooltipProvider>
          <RouterProvider router={router} />
        </TooltipProvider>
      </ThemeRuntime>
    </QueryClientProvider>
  );
}
