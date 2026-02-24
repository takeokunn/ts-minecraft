import { Effect, Layer, Context } from 'effect'
import * as THREE from 'three'

// Import existing services
import { RendererService, RendererServiceLive } from '@/infrastructure/three/renderer/renderer-service'
import { SceneService, SceneServiceLive } from '@/infrastructure/three/scene/scene-service'
import { PerspectiveCameraService, PerspectiveCameraServiceLive, DEFAULT_CAMERA_OFFSET, DEFAULT_LERP_FACTOR } from '@/infrastructure/three/camera/perspective'
import { TextureService, TextureServiceLive, BlockMeshService, BlockMeshServiceLive } from '@/infrastructure/three'
import { WorldRendererService, WorldRendererServiceLive } from '@/infrastructure/three/world-renderer'
import { FPSCounter, FPSCounterLive } from '@/presentation/fps-counter'
import { BlockRegistry, BlockRegistryLive } from '@/domain'

// Import new Phase 3 services
import { TerrainService, TerrainServiceLive } from '@/application/terrain'
import { PlayerService, PlayerServiceLive } from '@/domain/player'
import { WorldService, WorldServiceLive } from '@/domain/world'

// Import types
import { PlayerId } from '@/shared/kernel'
import { WorldId } from '@/shared/kernel'

// Base layers - these have no dependencies on other services
const BaseLayers = Layer.mergeAll(
  RendererServiceLive,
  SceneServiceLive,
  PerspectiveCameraServiceLive,
  TextureServiceLive,
  BlockMeshServiceLive,
  BlockRegistryLive,
  FPSCounterLive,
  PlayerServiceLive,
  WorldServiceLive,
)

// Main Layer composition with all Phase 3 services
// TerrainServiceLive and WorldRendererServiceLive depend on WorldService
const MainLive = Layer.mergeAll(
  BaseLayers,
  Layer.provide(TerrainServiceLive, BaseLayers),
  Layer.provide(WorldRendererServiceLive, BaseLayers)
)

// Main application
const mainProgram = Effect.gen(function* () {
  // Get canvas element
  const canvas = yield* Effect.try({
    try: () => {
      const el = document.getElementById('game-canvas')
      if (!el) {
        throw new Error('Canvas element not found')
      }
      return el as HTMLCanvasElement
    },
    catch: (error) => new Error(`Failed to get canvas: ${error}`),
  })

  // Get services
  const rendererService = yield* RendererService
  const sceneService = yield* SceneService
  const cameraService = yield* PerspectiveCameraService
  const playerService = yield* PlayerService
  const worldService = yield* WorldService
  const terrainService = yield* TerrainService
  const worldRendererService = yield* WorldRendererService
  const fpsCounter = yield* FPSCounter

  // Create renderer
  const renderer = yield* rendererService.create(canvas)

  // Create scene
  const scene = yield* sceneService.create()

  // Create camera
  const camera = yield* cameraService.create({
    fov: 75,
    aspect: canvas.clientWidth / canvas.clientHeight,
    near: 0.1,
    far: 1000,
  })

  // Position camera at default offset
  yield* cameraService.setPosition(camera, DEFAULT_CAMERA_OFFSET)

  // Create player
  const playerId = 'player-1' as PlayerId
  yield* playerService.create(playerId, { x: 0, y: 1, z: 0 })

  // Create world
  const worldId = 'world-1' as WorldId
  yield* worldService.create(worldId)

  // Generate flat terrain (20x20)
  yield* terrainService.generateFlatWorld(worldId, 20)

  // Sync world to scene
  yield* worldRendererService.syncWorld(worldId, scene)

  // Add directional light
  const light = new THREE.DirectionalLight(0xffffff, 1)
  light.position.set(5, 10, 7)
  yield* sceneService.add(scene, light)

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5)
  yield* sceneService.add(scene, ambientLight)

  // FPS display
  const fpsElement = document.getElementById('fps-value')

  // Run update loop (manual loop for Phase 3)
  let lastTime = performance.now()
  let moveTime = 0

  const updateLoop = () => {
    const now = performance.now()
    const deltaTime = (now - lastTime) / 1000
    lastTime = now
    moveTime += deltaTime

    // Simple back-and-forth movement
    const x = Math.sin(moveTime * 0.5) * 5
    Effect.runPromise(
      Effect.gen(function* () {
        yield* playerService.updatePosition(playerId, { x, y: 1, z: 0 })

        // Update camera follow
        const playerPos = yield* playerService.getPosition(playerId)
        yield* cameraService.smoothFollow(
          camera,
          playerPos,
          DEFAULT_CAMERA_OFFSET,
          DEFAULT_LERP_FACTOR
        )

        // Update FPS display
        const fps = yield* fpsCounter.getFPS()
        if (fpsElement) {
          fpsElement.textContent = fps.toFixed(1)
        }

        // Tick FPS counter
        yield* fpsCounter.tick(deltaTime)
      })
    ).catch((error) => {
      console.error('Update error:', error)
    })

    renderer.render(scene, camera)
    requestAnimationFrame(updateLoop)
  }

  yield* Effect.log('Game started with Phase 3 architecture')
  updateLoop()
})

// Run program
Effect.runPromise(
  mainProgram.pipe(
    Effect.provide(MainLive),
  ),
).catch((error: unknown) => {
  console.error('Failed to start application:', error)
  throw error
})
