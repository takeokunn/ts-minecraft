import { Layer } from 'effect'

export {
  RuntimePresentationLayers,
} from './presentation-runtime-bundles'
export {
  MenuPresentationLayers,
} from './presentation-menu-bundles'
export {
  OverlayPresentationLayers,
} from './presentation-overlay-bundles'

import { RuntimePresentationLayers } from './presentation-runtime-bundles'
import { MenuPresentationLayers } from './presentation-menu-bundles'
import { OverlayPresentationLayers } from './presentation-overlay-bundles'

export const PresentationLayers = RuntimePresentationLayers.pipe(
  Layer.provideMerge(MenuPresentationLayers),
  Layer.provideMerge(OverlayPresentationLayers),
)
