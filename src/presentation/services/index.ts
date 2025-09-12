/**
 * Presentation Services
 * プレゼンテーション層のサービス群
 * ブラウザAPIをEffect-TSでラップした安全なサービス
 */

export {
  BrowserApiService,
  BrowserApiServiceLive,
  createBrowserApiService,
  type BrowserApiServiceInterface,
  type MemoryInfo,
  BrowserApiError,
  LocalStorageError,
  PerformanceError,
} from './browser-api.service'