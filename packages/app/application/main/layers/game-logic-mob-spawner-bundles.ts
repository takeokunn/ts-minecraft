import { Effect, Layer } from 'effect'

import { MobSpawner, TimeServicePort } from '@ts-minecraft/entity'
import { TimeService } from '@ts-minecraft/game'

import { EntityManagerLayer } from './game-logic-entity-manager-bundles'

export const TimeServicePortLayer = Layer.effect(
  TimeServicePort,
  Effect.map(TimeService, (timeService) =>
    TimeServicePort.of({
      _tag: '@minecraft/entity/domain/TimeServicePort' as const,
      isNight: () => timeService.isNight(),
    }),
  ),
).pipe(Layer.provide(TimeService.Default))

export const MobSpawnerLayer = MobSpawner.Default.pipe(
  Layer.provide(EntityManagerLayer),
  Layer.provide(TimeServicePortLayer),
)
