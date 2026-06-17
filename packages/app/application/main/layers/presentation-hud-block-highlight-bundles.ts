import { Layer } from 'effect'

import { BlockHighlightService } from '@ts-minecraft/presentation'

import { RaycastingLayer } from './game-logic-player-raycasting-bundles'

export const BlockHighlightPresentationLayer = BlockHighlightService.Default.pipe(
  Layer.provide(RaycastingLayer),
)
