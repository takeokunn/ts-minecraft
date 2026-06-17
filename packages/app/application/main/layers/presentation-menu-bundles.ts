import { Layer } from 'effect'

import { ConfirmDialogLayer } from './presentation-confirm-dialog-bundles'
import { DeathScreenLayer } from './presentation-death-screen-bundles'
import { LoadingScreenLayer } from './presentation-loading-screen-bundles'
import { MainMenuLayer } from './presentation-main-menu-bundles'

export const MenuPresentationLayers = ConfirmDialogLayer.pipe(
  Layer.provideMerge(MainMenuLayer),
  Layer.provideMerge(DeathScreenLayer),
  Layer.provideMerge(LoadingScreenLayer),
)
