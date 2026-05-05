import { Effect, Ref } from 'effect'
import { resolveBlockCollisions } from '@ts-minecraft/physics'
import type { Chunk } from '@ts-minecraft/terrain'
import { chunkBlockIndexUnchecked } from '@ts-minecraft/terrain'
import { MOB_HALF_HEIGHT, MOB_HALF_WIDTH } from '@ts-minecraft/entities'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { advanceFixedStep } from '@ts-minecraft/app/frame/frame-runtime-logic'
import { REDSTONE_TICK_INTERVAL_SECS, FLUID_TICK_INTERVAL_SECS } from '@ts-minecraft/app/frame-handler.config'
import { CHUNK_HEIGHT, CHUNK_SIZE, type DeltaTimeSecs, type Position } from '@ts-minecraft/kernel'

export const entityUpdateStage = (
  deps: Pick<FrameHandlerDeps, 'scene'>,
  services: Pick<
    FrameHandlerServices,
    'chunkManagerService' | 'entityManager' | 'entityRenderer' | 'redstoneService' | 'fluidService' | 'particleSystem'
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

    const applyPhysics = services.entityManager.applyPhysics
    if (typeof applyPhysics === 'function') {
      const playerCx = Math.floor(inputs.playerPos.x / CHUNK_SIZE)
      const playerCz = Math.floor(inputs.playerPos.z / CHUNK_SIZE)
      const chunkCache: ReadonlyArray<Chunk | null> = yield* Effect.all(
        Array.from({ length: 9 }, (_, index) => {
          const dx = Math.floor(index / 3) - 1
          const dz = (index % 3) - 1

          return services.chunkManagerService.getChunk({
            x: playerCx + dx,
            z: playerCz + dz,
          }).pipe(
            Effect.option,
            Effect.map((chunkOption) => (chunkOption._tag === 'Some' ? chunkOption.value : null)),
          )
        }),
        { concurrency: 'unbounded' },
      )

      const isBlockSolid = (wx: number, wy: number, wz: number): boolean => {
        const ly = Math.floor(wy)
        if (ly < 0) return true
        if (ly >= CHUNK_HEIGHT) return false

        const bx = Math.floor(wx)
        const bz = Math.floor(wz)
        const cx = Math.floor(bx / CHUNK_SIZE)
        const cz = Math.floor(bz / CHUNK_SIZE)
        const dx = cx - playerCx
        const dz = cz - playerCz
        if (dx < -1 || dx > 1 || dz < -1 || dz > 1) return false

        const cachedChunk = chunkCache[(dx + 1) * 3 + (dz + 1)]
        if (cachedChunk == null) return false

        const lx = ((bx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        const lz = ((bz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
        return (cachedChunk.blocks[chunkBlockIndexUnchecked(lx, ly, lz)] ?? 0) !== 0
      }

      yield* logErrors(
        applyPhysics(inputs.deltaTime, (position: Position, velocity: { x: number; y: number; z: number }) =>
          resolveBlockCollisions(position, velocity, MOB_HALF_WIDTH, MOB_HALF_HEIGHT, isBlockSolid)
        ),
        'Entity physics error',
      )
    }

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
