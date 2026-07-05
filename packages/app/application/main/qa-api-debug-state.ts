import { Effect, Option } from 'effect'
import * as THREE from 'three'
import { DEFAULT_PLAYER_ID } from '@ts-minecraft/core'
import type { GameStateService, TimeService, WeatherService } from '@ts-minecraft/game'
import type { ChunkManagerService } from '@ts-minecraft/world'
import type { EntityManager } from '@ts-minecraft/entity/application/mob/entity-manager'
import type { InventoryService } from '@ts-minecraft/inventory/application/inventory-service'
import type { XPService } from '@ts-minecraft/entity/application/xp-service'

type DimensionReader = {
  readonly getDimension: () => Effect.Effect<'overworld' | 'nether' | 'end', never>
}

// Everything a debugging session usually wants, in ONE call. The many separate
// QA reads (position, then health, then entities, then rendering…) each cost a
// browser round-trip and can observe the world at slightly different frames;
// this samples them together and returns a flat, greppable snapshot. Values are
// raw (no thresholds/verdicts) so callers decide what "wrong" means.
export type QaDebugState = {
  readonly player: {
    readonly position: { x: number; y: number; z: number } | null
    readonly rotation: { yaw: number; pitch: number }
    readonly grounded: boolean
    readonly boating: boolean
    readonly minecarting: boolean
    readonly healthHud: number | null
    readonly hungerHud: number | null
    readonly xp: { level: number; totalXP: number; xpIntoLevel: number }
  }
  readonly world: {
    readonly dimension: 'overworld' | 'nether' | 'end'
    readonly timeOfDay: number
    readonly isNight: boolean
    readonly weather: string
    readonly loadedChunkCount: number
  }
  readonly entities: {
    readonly total: number
    readonly byType: Record<string, number>
    readonly lowestHealth: { type: string; health: number } | null
  }
  readonly inventory: {
    readonly occupiedSlots: number
    readonly totalItems: number
    readonly items: ReadonlyArray<{ slot: number; itemType: string; count: number }>
  }
  readonly rendering: {
    readonly camera: { x: number; y: number; z: number; near: number; far: number }
    readonly sceneChildren: number
    readonly chunkMeshCount: number
    readonly visibleChunkMeshCount: number
    readonly jsHeapUsedMB: number | null
  }
}

type DebugStateDeps = {
  readonly gameState: GameStateService
  readonly netherService: DimensionReader
  readonly timeService: TimeService
  readonly weatherService: WeatherService
  readonly chunkManagerService: ChunkManagerService
  readonly entityManager: EntityManager
  readonly inventoryService: InventoryService
  readonly xpService: XPService
  readonly camera: THREE.PerspectiveCamera
  readonly scene: THREE.Scene
}

const readHudNumber = (id: string): number | null => {
  /* c8 ignore next -- browser runtime always provides document */
  if (typeof document === 'undefined') return null
  const el = document.getElementById(id)
  if (el === null) return null
  const n = Number.parseFloat(el.textContent ?? '')
  return Number.isFinite(n) ? n : null
}

const readHeapMB = (): number | null => {
  const perf = typeof performance !== 'undefined' ? (performance as unknown as { memory?: { usedJSHeapSize: number } }) : undefined
  return perf?.memory ? Math.round(perf.memory.usedJSHeapSize / 1_048_576) : null
}

const isChunkMesh = (child: THREE.Object3D): boolean =>
  child instanceof THREE.Mesh &&
  typeof (child.userData as { chunkCoord?: unknown }).chunkCoord === 'object' &&
  (child.userData as { chunkCoord?: unknown }).chunkCoord !== null

export const getDebugStateForQA = (deps: DebugStateDeps): Promise<QaDebugState> =>
  Effect.runPromise(Effect.gen(function* () {
    const position = yield* deps.gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(
      Effect.map((p) => ({ x: p.x, y: p.y, z: p.z })),
      Effect.catchAll(() => Effect.succeed(null)),
    )
    const rotation = yield* deps.gameState.getCameraRotation()
    const grounded = yield* deps.gameState.isPlayerGrounded()
    const boating = yield* deps.gameState.isBoating()
    const minecarting = yield* deps.gameState.isMinecarting()
    const xp = yield* deps.xpService.getXP()
    const dimension = yield* deps.netherService.getDimension()
    const timeOfDay = yield* deps.timeService.getTimeOfDay()
    const isNight = yield* deps.timeService.isNight()
    const weather = yield* deps.weatherService.getWeather()
    const loadedChunks = yield* deps.chunkManagerService.getLoadedChunks()
    const entities = yield* deps.entityManager.getEntities()
    const slots = yield* deps.inventoryService.getAllSlots()

    const byType: Record<string, number> = {}
    let lowestHealth: { type: string; health: number } | null = null
    for (const e of entities) {
      byType[e.type] = (byType[e.type] ?? 0) + 1
      if (lowestHealth === null || e.health < lowestHealth.health) {
        lowestHealth = { type: e.type, health: e.health }
      }
    }

    const items: Array<{ slot: number; itemType: string; count: number }> = []
    let totalItems = 0
    slots.forEach((slot, index) => {
      const s = Option.getOrNull(slot)
      if (s !== null) {
        items.push({ slot: index, itemType: s.itemType, count: s.count })
        totalItems += s.count
      }
    })

    let sceneChildren = 0
    let chunkMeshCount = 0
    let visibleChunkMeshCount = 0
    deps.scene.traverse((child) => {
      sceneChildren += 1
      if (isChunkMesh(child)) {
        chunkMeshCount += 1
        if (child.visible) visibleChunkMeshCount += 1
      }
    })

    return {
      player: {
        position,
        rotation,
        grounded,
        boating,
        minecarting,
        healthHud: readHudNumber('health-value'),
        hungerHud: readHudNumber('hunger-value'),
        xp: { level: xp.level, totalXP: xp.totalXP, xpIntoLevel: xp.xpIntoLevel },
      },
      world: {
        dimension,
        timeOfDay,
        isNight,
        weather,
        loadedChunkCount: loadedChunks.length,
      },
      entities: {
        total: entities.length,
        byType,
        lowestHealth,
      },
      inventory: {
        occupiedSlots: items.length,
        totalItems,
        items,
      },
      rendering: {
        camera: {
          x: deps.camera.position.x,
          y: deps.camera.position.y,
          z: deps.camera.position.z,
          near: deps.camera.near,
          far: deps.camera.far,
        },
        sceneChildren,
        chunkMeshCount,
        visibleChunkMeshCount,
        jsHeapUsedMB: readHeapMB(),
      },
    }
  }))
