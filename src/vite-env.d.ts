/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** 游戏图片/字体 CDN（等价旧版 environment.assetsHost） */
  readonly VITE_ASSETS_HOST?: string;
  /** 图片开关（等价旧版 environment.enableImages） */
  readonly VITE_ENABLE_IMAGES?: string;
  /** LCDX 业务后端（机台/权限/引继/公告；等价旧版 environment.lcdxApiServer。生产为同域 '/'，开发直连远程） */
  readonly VITE_LCDX_API_SERVER?: string;
  /** maimai 专用资源 CDN（等价旧版 environment.maiAssetsHost；生产走 alist） */
  readonly VITE_MAI_ASSETS_HOST?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
