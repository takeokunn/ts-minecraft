import { Layer } from 'effect'

import { GameplaySupportLayers } from './game-logic-gameplay-support-bundles'
import { EntityManagerLayer } from './game-logic-entity-manager-bundles'
import { FluidLayer } from './game-logic-fluid-bundles'
import { LightEngineLayer } from './game-logic-light-engine-bundles'
import { MobSpawnerLayer } from './game-logic-mob-spawner-bundles'
import { PresentationRuntimeLayers } from './game-logic-presentation-runtime-bundles'
import { RuntimeCoreLayers } from './game-logic-runtime-core-bundles'
import { ChunkManagerLayer } from './game-logic-chunk-manager-bundles'
import { WorldServiceLayers } from './game-logic-world-bundles'

export const GameLogicLayers = RuntimeCoreLayers.pipe(
  Layer.provideMerge(LightEngineLayer),
).pipe(
  Layer.provideMerge(ChunkManagerLayer),
).pipe(
  Layer.provideMerge(FluidLayer),
).pipe(
  Layer.provideMerge(EntityManagerLayer),
).pipe(
  Layer.provideMerge(MobSpawnerLayer),
).pipe(
  Layer.provideMerge(WorldServiceLayers),
).pipe(
  Layer.provideMerge(GameplaySupportLayers),
).pipe(
  Layer.provideMerge(PresentationRuntimeLayers),
)
