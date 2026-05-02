import { Effect, Ref } from 'effect'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { advanceFixedStep } from '@ts-minecraft/app/frame/frame-runtime-logic'
import { REDSTONE_TICK_INTERVAL_SECS, FLUID_TICK_INTERVAL_SECS } from '@ts-minecraft/app/frame-handler.config'
import type { DeltaTimeSecs, Position } from '@ts-minecraft/kernel'

export const entityUpdateStage = (
  deps: Pick<FrameHandlerDeps, 'scene'>,
  services: Pick<
    FrameHandlerServices,
    'entityManager' | 'entityRenderer' | 'redstoneService' | 'fluidService' | 'particleSystem'
  >,
  refs: Pick<
    FrameStageRefs,
    'lastEntityStructureVersionRef' | 'redstoneTickAccumulatorRef' | 'fluidTickAccumulatorRef'
  >,
  inputs: {
    readonly deltaTime: DeltaTimeSecs
    readonly playerPos: Position
    readonly totalTimeSecs: number
  },
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // Entity simulation stays on the frame lane so visible transforms remain responsive.
    // Slower world simulation (furnace/spawn/village) runs on the maintenance lane.
    yield* logErrors(services.entityManager.update(inputs.deltaTime, inputs.playerPos), 'Entity system error')

    yield* logErrors(
      Effect.all(
        [services.entityManager.getEntities(), services.entityManager.getStructureVersion()],
        { concurrency: 'unbounded' },
      ).pipe(
        Effect.flatMap(([entitiesSnapshot, structureVersion]) =>
          Ref.get(refs.lastEntityStructureVersionRef).pipe(
            Effect.flatMap((lastStructureVersion) =>
              (lastStructureVersion === structureVersion
                ? Effect.void
                : services.entityRenderer.syncEntities(entitiesSnapshot, deps.scene).pipe(
                    Effect.andThen(Ref.set(refs.lastEntityStructureVersionRef, structureVersion)),
                  )
              ).pipe(
                Effect.andThen(
                  services.entityRenderer.updateEntityTransforms(
                    entitiesSnapshot,
                    inputs.totalTimeSecs,
                    inputs.deltaTime,
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
      'Entity render error',
    )

    yield* logErrors(
      Ref.modify(refs.redstoneTickAccumulatorRef, (accumulated) => {
        const { ticks, remainder } = advanceFixedStep(accumulated, inputs.deltaTime, REDSTONE_TICK_INTERVAL_SECS)
        return [ticks, remainder]
      }).pipe(
        Effect.flatMap((ticksToRun) =>
          ticksToRun === 1
            ? services.redstoneService.tick().pipe(Effect.asVoid)
            : ticksToRun > 1
              ? Effect.repeatN(services.redstoneService.tick(), ticksToRun - 1).pipe(Effect.asVoid)
              : Effect.void,
        ),
      ),
      'Redstone system error',
    )

    yield* logErrors(
      Ref.modify(refs.fluidTickAccumulatorRef, (accumulated) => {
        const { ticks, remainder } = advanceFixedStep(accumulated, inputs.deltaTime, FLUID_TICK_INTERVAL_SECS)
        return [ticks, remainder]
      }).pipe(
        Effect.flatMap((ticksToRun) =>
          ticksToRun === 1
            ? services.fluidService.tick().pipe(Effect.asVoid)
            : ticksToRun > 1
              ? Effect.repeatN(services.fluidService.tick(), ticksToRun - 1).pipe(Effect.asVoid)
              : Effect.void,
        ),
      ),
      'Fluid system error',
    )

    // FR-1.6 — block-break particles: integrate position/velocity/lifetime
    // and write the InstancedMesh's instanceMatrix exactly once per frame.
    yield* logErrors(services.particleSystem.update(inputs.deltaTime), 'Particle system error')
  })
