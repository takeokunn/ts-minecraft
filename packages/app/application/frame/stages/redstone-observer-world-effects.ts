import { Effect } from 'effect'
import type { BlockType, Position } from '@ts-minecraft/core'
import { RedstoneComponentType, type PistonFacing, type RedstoneComponent } from '@ts-minecraft/entity/domain/redstone/redstone-model'
import type { FrameHandlerServices } from '@ts-minecraft/app/application/frame/types/services'

export type RedstoneObserverWorldServices = Pick<FrameHandlerServices, 'blockService' | 'redstoneService'>

const WATCH_DIRECTIONS: Readonly<Record<PistonFacing, { readonly x: number; readonly y: number; readonly z: number }>> = {
  east: { x: 1, y: 0, z: 0 },
  west: { x: -1, y: 0, z: 0 },
  south: { x: 0, y: 0, z: 1 },
  north: { x: 0, y: 0, z: -1 },
  up: { x: 0, y: 1, z: 0 },
  down: { x: 0, y: -1, z: 0 },
}

const OBSERVER_PULSE_TICKS = 2

const watchKey = (position: Position): string =>
  `${Math.floor(position.x)},${Math.floor(position.y)},${Math.floor(position.z)}`

const watchedCell = (observer: RedstoneComponent): Position => {
  const direction = WATCH_DIRECTIONS[observer.state.pistonFacing ?? 'east']
  return {
    x: Math.floor(observer.position.x) + direction.x,
    y: Math.floor(observer.position.y) + direction.y,
    z: Math.floor(observer.position.z) + direction.z,
  }
}

// Last block type each observer saw in its watched cell. Module scratch keyed
// by observer position: entries for removed observers are dropped on sweep,
// and a stale entry after a world switch costs at most one spurious pulse.
const lastSeenBlocks = new Map<string, BlockType>()

// Exposed for tests: reset the change-detection memory between scenarios.
export const resetObserverWatchState = (): void => {
  lastSeenBlocks.clear()
}

// Emits a short redstone pulse from every observer whose watched cell's block
// type changed since the previous redstone tick. First sighting only arms the
// detector (no pulse) — placement next to an existing block must not fire.
export const applyObserverWorldEffects = (
  services: RedstoneObserverWorldServices,
  components: ReadonlyArray<RedstoneComponent>,
): Effect.Effect<void, never> =>
  Effect.gen(function* () {
    const liveKeys = new Set<string>()

    for (const component of components) {
      if (component.type !== RedstoneComponentType.Observer) continue
      const key = watchKey(component.position)
      liveKeys.add(key)

      const cell = watchedCell(component)
      const blockType = yield* services.blockService.getBlock(cell).pipe(
        Effect.catchAll(() => Effect.succeed<BlockType | null>(null)),
      )
      if (blockType === null) continue

      const lastSeen = lastSeenBlocks.get(key)
      lastSeenBlocks.set(key, blockType)
      if (lastSeen === undefined || lastSeen === blockType) continue

      yield* services.redstoneService.pulseObserver(component.position, OBSERVER_PULSE_TICKS).pipe(Effect.asVoid)
    }

    // Sweep entries whose observers no longer exist (mined/replaced).
    for (const key of lastSeenBlocks.keys()) {
      if (!liveKeys.has(key)) lastSeenBlocks.delete(key)
    }
  })
