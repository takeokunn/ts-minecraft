import { Layer } from 'effect'

import { RuntimePresentationLayers } from './presentation-runtime-bundles'
import { MenuPresentationLayers } from './presentation-menu-bundles'
import { OverlayPresentationLayers } from './presentation-overlay-bundles'
import { SettingsPresentationLayers } from './presentation-overlay-settings-bundles'

export const PresentationLayers = RuntimePresentationLayers.pipe(
  Layer.provideMerge(MenuPresentationLayers),
  Layer.provideMerge(OverlayPresentationLayers),
  Layer.provideMerge(SettingsPresentationLayers),
)
