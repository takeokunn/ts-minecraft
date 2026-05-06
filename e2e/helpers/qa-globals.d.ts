export {}
import type { QaApi } from '@ts-minecraft/app/main/qa-api'

declare global {
  type Page = import('@playwright/test').PlaywrightTestArgs['page']

  type ConsoleMessage = {
    readonly type: () => string
    readonly text: () => string
  }

  interface Window {
    __TS_MINECRAFT_QA__?: QaApi
  }
}
