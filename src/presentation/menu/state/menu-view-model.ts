import type { SettingsMenuModel } from '@application/settings'

import type { MenuAction, MenuRoute } from '../types'

export interface MenuViewModel {
  readonly route: MenuRoute
  readonly mainActions: ReadonlyArray<MenuAction>
  readonly pauseActions: ReadonlyArray<MenuAction>
  readonly settings: SettingsMenuModel
}
