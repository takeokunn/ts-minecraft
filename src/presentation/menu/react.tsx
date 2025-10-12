import type { PropsWithChildren } from 'react'
import { createContext, useContext } from 'react'

interface MenuActionsReactValue {
  readonly openMain: () => void
  readonly openPause: () => void
  readonly openSettings: () => void
  readonly closeMenu: () => void
  readonly back: () => void
}

const noop = () => {
  // no-op placeholder for未初期化時
}

const MenuActionsReactContext = createContext<MenuActionsReactValue>({
  openMain: noop,
  openPause: noop,
  openSettings: noop,
  closeMenu: noop,
  back: noop,
})

export interface MenuActionsProviderProps extends PropsWithChildren {
  readonly value: MenuActionsReactValue
}

export const MenuActionsProvider = ({ value, children }: MenuActionsProviderProps) => (
  <MenuActionsReactContext.Provider value={value}>{children}</MenuActionsReactContext.Provider>
)

export const useMenuActions = (): MenuActionsReactValue => useContext(MenuActionsReactContext)
