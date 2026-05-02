/**
 * Stage 7: interactionStage — block highlight, then break/place/redstone interactions.
 *
 * Decomposed into 4 helpers (P1-8):
 *   - handleHotbarInput   — keyboard 1-9 / wheel slot selection + HUD update
 *   - handleRedstoneInput — 8-way Match dispatch on redstone key flags
 *   - handleLeftClick     — entity attack / block break / particle burst
 *   - handleRightClick    — furnace select / block place
 */
import { Effect, HashMap, Match, Option, Ref } from 'effect'
import { logErrors } from '@ts-minecraft/app/frame/error-logging'
import type { FrameHandlerDeps, FrameHandlerServices, FrameStageRefs } from '@ts-minecraft/app/frame/types'
import { findAttackableEntity } from '@ts-minecraft/app/frame/stages/attack-targeting'
import { CHUNK_SIZE, CHUNK_HEIGHT, indexToBlockType } from '@ts-minecraft/domain'
import { HOTBAR_START } from '@ts-minecraft/inventory-system'
import { SlotIndex } from '@ts-minecraft/kernel'
import { RedstoneComponentType } from '@ts-minecraft/redstone-circuit'
import { getParticleUvOffset } from '@ts-minecraft/world-renderer/particles/particle-system'
import {
  PLAYER_ATTACK_DAMAGE,
  WOODEN_SWORD_ATTACK_DAMAGE,
  REDSTONE_PLACE_WIRE_KEY,
  REDSTONE_PLACE_LEVER_KEY,
  REDSTONE_PLACE_BUTTON_KEY,
  REDSTONE_PLACE_TORCH_KEY,
  REDSTONE_PLACE_PISTON_KEY,
  REDSTONE_TOGGLE_LEVER_KEY,
  REDSTONE_PRESS_BUTTON_KEY,
  REDSTONE_TOGGLE_TORCH_KEY,
} from '@ts-minecraft/app/frame-handler.config'
import type { Position } from '@ts-minecraft/kernel'

type RedstoneFlags = {
  readonly placeWire: boolean
  readonly placeLever: boolean
  readonly placeButton: boolean
  readonly placeTorch: boolean
  readonly placePiston: boolean
  readonly toggleLever: boolean
  readonly pressButton: boolean
  readonly toggleTorch: boolean
}

type TargetBlockHit = { readonly x: number; readonly y: number; readonly z: number }
type TargetRayHit = {
  readonly blockX: number
  readonly blockY: number
  readonly blockZ: number
  readonly distance: number
  readonly normal: { readonly x: number; readonly y: number; readonly z: number }
}

const handleHotbarInput = (
  services: Pick<FrameHandlerServices, 'hotbarService'>,
): Effect.Effect<void, never> =>
  // Update hotbar slot selection (keyboard 1-9 and mouse wheel)
  services.hotbarService.update()

const renderHotbarHud = (
  services: Pick<FrameHandlerServices, 'hotbarService' | 'hotbarRenderer'>,
): Effect.Effect<void, never> =>
  Effect.all(
    [services.hotbarService.getSlots(), services.hotbarService.getSelectedSlot()],
    { concurrency: 'unbounded' },
  ).pipe(Effect.flatMap(([slots, selectedSlot]) => services.hotbarRenderer.update(slots, selectedSlot)))

const dispatchRedstoneAction = (
  services: Pick<FrameHandlerServices, 'redstoneService'>,
  flags: RedstoneFlags,
  position: Position,
): Effect.Effect<void, never> =>
  Match.value(flags).pipe(
    Match.when({ placeWire: true }, () => services.redstoneService.setComponent(position, RedstoneComponentType.Wire)),
    Match.when({ placeLever: true }, () => services.redstoneService.setComponent(position, RedstoneComponentType.Lever)),
    Match.when({ placeButton: true }, () => services.redstoneService.setComponent(position, RedstoneComponentType.Button)),
    Match.when({ placeTorch: true }, () => services.redstoneService.setComponent(position, RedstoneComponentType.Torch)),
    Match.when({ placePiston: true }, () => services.redstoneService.setComponent(position, RedstoneComponentType.Piston)),
    Match.when({ toggleLever: true }, () => services.redstoneService.toggleLever(position)),
    Match.when({ pressButton: true }, () => services.redstoneService.pressButton(position)),
    Match.when({ toggleTorch: true }, () => services.redstoneService.toggleTorch(position)),
    Match.orElse(() => Effect.void),
  )

const handleRedstoneInput = (
  services: Pick<FrameHandlerServices, 'redstoneService'>,
  flags: RedstoneFlags,
  targetBlock: Option.Option<TargetBlockHit>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    yield* Option.match(targetBlock, {
      onNone: () => Effect.void,
      onSome: (tb) => dispatchRedstoneAction(services, flags, { x: tb.x, y: tb.y, z: tb.z }),
    })
    yield* services.redstoneService.tick()
  })

const handleLeftClick = (
  deps: Pick<FrameHandlerDeps, 'camera'>,
  services: Pick<
    FrameHandlerServices,
    | 'blockService'
    | 'chunkManagerService'
    | 'soundManager'
    | 'entityManager'
    | 'inventoryService'
    | 'particleSystem'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: {
    readonly targetBlock: Option.Option<TargetBlockHit>
    readonly targetHit: Option.Option<TargetRayHit>
    readonly selectedHotbarItem: Option.Option<string>
  },
) =>
  Effect.gen(function* () {
    const targetEntity = yield* services.entityManager.getEntities().pipe(
      Effect.map((entities) =>
        findAttackableEntity(entities, deps.camera, Option.map(context.targetHit, (hit) => hit.distance)),
      ),
    )

    yield* Option.match(targetEntity, {
      onNone: () =>
        Option.match(context.targetBlock, {
          onNone: () => Effect.void,
          onSome: (tb) => {
            const pos = { x: tb.x, y: tb.y, z: tb.z }
            const chunkCoord = { x: Math.floor(tb.x / CHUNK_SIZE), z: Math.floor(tb.z / CHUNK_SIZE) }
            const coordKey = `${chunkCoord.x},${chunkCoord.z}`
            // FR-1.6 — read block type BEFORE breakBlock mutates it so the
            // particle UV uses the correct atlas tile. Falls back to dirt
            // (tile 0) if the local index is out of range.
            const lx = ((tb.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
            const lz = ((tb.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
            const flatIdx = tb.y + lz * CHUNK_HEIGHT + lx * CHUNK_HEIGHT * CHUNK_SIZE
            return services.chunkManagerService.getChunk(chunkCoord).pipe(
              Effect.flatMap((preBreakChunk) => {
                const blockId = preBreakChunk.blocks[flatIdx] ?? 0
                const uv = getParticleUvOffset(blockId)
                return Effect.all(
                  [
                    services.blockService.breakBlock(pos),
                    services.soundManager.playEffect('blockBreak', { position: pos }),
                    // 6 particles per break — center-of-block origin so the
                    // burst expands outward symmetrically.
                    services.particleSystem.spawnBurst(
                      tb.x + 0.5,
                      tb.y + 0.5,
                      tb.z + 0.5,
                      uv.u,
                      uv.v,
                      6,
                    ),
                  ],
                  { concurrency: 'unbounded', discard: true },
                ).pipe(
                  Effect.andThen(services.chunkManagerService.getChunk(chunkCoord)),
                  Effect.flatMap((updatedChunk) =>
                    Ref.update(refs.dirtyChunksRef, (map) => HashMap.set(map, coordKey, updatedChunk)),
                  ),
                )
              }),
            )
          },
        }),
      onSome: (entityId) =>
        services.entityManager
          .applyDamage(
            entityId,
            Option.match(context.selectedHotbarItem, {
              onNone: () => PLAYER_ATTACK_DAMAGE,
              onSome: (item) => (item === 'WOODEN_SWORD' ? WOODEN_SWORD_ATTACK_DAMAGE : PLAYER_ATTACK_DAMAGE),
            }),
          )
          .pipe(
            Effect.flatMap((drops) =>
              Effect.forEach(
                Option.getOrElse(drops, () => []),
                (drop) => services.inventoryService.addBlock(drop.blockType, drop.count),
                { concurrency: 'unbounded', discard: true },
              ),
            ),
          ),
    })
  })

const handleRightClick = (
  services: Pick<
    FrameHandlerServices,
    'blockService' | 'chunkManagerService' | 'soundManager' | 'hotbarService' | 'furnaceService'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
  context: { readonly targetHit: Option.Option<TargetRayHit> },
) =>
  Option.match(context.targetHit, {
    onNone: () => Effect.void,
    onSome: (hit) => {
      const targetPos = { x: hit.blockX, y: hit.blockY, z: hit.blockZ }
      const targetChunkCoord = {
        x: Math.floor(targetPos.x / CHUNK_SIZE),
        z: Math.floor(targetPos.z / CHUNK_SIZE),
      }
      return services.chunkManagerService.getChunk(targetChunkCoord).pipe(
        Effect.flatMap((targetChunk) => {
          const targetLx = ((targetPos.x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          const targetLz = ((targetPos.z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE
          const targetIdx = targetPos.y + targetLz * CHUNK_HEIGHT + targetLx * CHUNK_HEIGHT * CHUNK_SIZE
          const targetBlockType = indexToBlockType(targetChunk.blocks[targetIdx] ?? 0)
          if (targetBlockType === 'FURNACE') {
            return services.furnaceService.setSelectedFurnace(targetPos)
          }

          const adjacentPos = {
            x: hit.blockX + Math.round(hit.normal.x),
            y: hit.blockY + Math.round(hit.normal.y),
            z: hit.blockZ + Math.round(hit.normal.z),
          }
          return Effect.all(
            [services.hotbarService.getSelectedBlockType(), services.hotbarService.getSelectedSlot()],
            { concurrency: 'unbounded' },
          ).pipe(
            Effect.flatMap(([selectedBlock, selectedSlot]) =>
              Option.match(selectedBlock, {
                onNone: () => Effect.void,
                onSome: (blockType) => {
                  const chunkCoord = {
                    x: Math.floor(adjacentPos.x / CHUNK_SIZE),
                    z: Math.floor(adjacentPos.z / CHUNK_SIZE),
                  }
                  const coordKey = `${chunkCoord.x},${chunkCoord.z}`
                  return services.blockService
                    .placeBlock(adjacentPos, blockType, SlotIndex.make(HOTBAR_START + selectedSlot))
                    .pipe(
                      Effect.flatMap(() =>
                        services.soundManager.playEffect('blockPlace', { position: adjacentPos }),
                      ),
                      Effect.andThen(services.chunkManagerService.getChunk(chunkCoord)),
                      Effect.flatMap((updatedChunk) =>
                        Ref.update(refs.dirtyChunksRef, (map) => HashMap.set(map, coordKey, updatedChunk)),
                      ),
                    )
                },
              }),
            ),
          )
        }),
      )
    },
  })

export const interactionStage = (
  deps: Pick<FrameHandlerDeps, 'camera' | 'scene' | 'gamePausedRef'>,
  services: Pick<
    FrameHandlerServices,
    | 'blockHighlight'
    | 'hotbarService'
    | 'hotbarRenderer'
    | 'inputService'
    | 'blockService'
    | 'chunkManagerService'
    | 'soundManager'
    | 'entityManager'
    | 'inventoryService'
    | 'redstoneService'
    | 'furnaceService'
    | 'particleSystem'
  >,
  refs: Pick<FrameStageRefs, 'dirtyChunksRef'>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    // Update block highlight (always — independent of pause; spy uses scene state)
    yield* services.blockHighlight.update(deps.camera, deps.scene)

    // Handle block interaction (break/place) and hotbar (suppressed when paused)
    yield* logErrors(
      Effect.gen(function* () {
        const paused = yield* Ref.get(deps.gamePausedRef)
        if (paused) return

        yield* handleHotbarInput(services)

        const leftClick = yield* services.inputService.consumeMouseClick(0)
        const rightClick = yield* services.inputService.consumeMouseClick(2)
        const [
          placeWire,
          placeLever,
          placeButton,
          placeTorch,
          placePiston,
          toggleLever,
          pressButton,
          toggleTorch,
        ] = yield* Effect.all(
          [
            services.inputService.consumeKeyPress(REDSTONE_PLACE_WIRE_KEY),
            services.inputService.consumeKeyPress(REDSTONE_PLACE_LEVER_KEY),
            services.inputService.consumeKeyPress(REDSTONE_PLACE_BUTTON_KEY),
            services.inputService.consumeKeyPress(REDSTONE_PLACE_TORCH_KEY),
            services.inputService.consumeKeyPress(REDSTONE_PLACE_PISTON_KEY),
            services.inputService.consumeKeyPress(REDSTONE_TOGGLE_LEVER_KEY),
            services.inputService.consumeKeyPress(REDSTONE_PRESS_BUTTON_KEY),
            services.inputService.consumeKeyPress(REDSTONE_TOGGLE_TORCH_KEY),
          ],
          { concurrency: 'unbounded' },
        )
        const flags: RedstoneFlags = {
          placeWire,
          placeLever,
          placeButton,
          placeTorch,
          placePiston,
          toggleLever,
          pressButton,
          toggleTorch,
        }

        const hasRedstoneInput =
          placeWire || placeLever || placeButton || placeTorch || placePiston || toggleLever || pressButton || toggleTorch

        if (leftClick || rightClick || hasRedstoneInput) {
          const targetBlock = yield* services.blockHighlight.getTargetBlock()
          const targetHit = yield* services.blockHighlight.getTargetHit()
          const selectedHotbarItem = yield* services.hotbarService.getSelectedBlockType()

          if (hasRedstoneInput) {
            yield* handleRedstoneInput(services, flags, targetBlock)
          }

          if (leftClick) {
            yield* handleLeftClick(deps, services, refs, { targetBlock, targetHit, selectedHotbarItem })
          }

          if (rightClick) {
            yield* handleRightClick(services, refs, { targetHit })
          }
        }

        // Update hotbar renderer with current slot state (first pass; second pass in hudStage)
        yield* renderHotbarHud(services)
      }),
      'Block interaction error',
    )
  })
