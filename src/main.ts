import { Effect, Layer, Context } from 'effect'
import * as THREE from 'three'

// Import services
import { RendererService, RendererServiceLive } from '@/infrastructure/three/renderer/renderer-service'
import { SceneService, SceneServiceLive } from '@/infrastructure/three/scene/scene-service'
import { PerspectiveCameraService, PerspectiveCameraServiceLive } from '@/infrastructure/three/camera/perspective'
import { TextureService, TextureServiceLive, BlockMeshService, BlockMeshServiceLive } from '@/infrastructure/three'
import { FPSCounter, FPSCounterLive } from '@/presentation/fps-counter'
import { BlockRegistry, BlockRegistryLive } from '@/domain'

// Import core types from shared math layer for DDD purity
import { makeVector3, zero } from '@/infrastructure/three/core'

// Import object pools
import { Vector3Pool, QuaternionPool } from '@/shared/pool'

// Main Layer composition
const MainLive = Layer.mergeAll(
  RendererServiceLive,
  SceneServiceLive,
  PerspectiveCameraServiceLive,
  TextureServiceLive,
  BlockMeshServiceLive,
  BlockRegistryLive,
  FPSCounterLive,
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
  const blockMeshService = yield* BlockMeshService
  const fpsCounter = yield* FPSCounter

  // Create renderer
  const renderer = yield* rendererService.create(canvas)

  // Create scene
  const scene = yield* sceneService.create()

  // Create camera
  const cameraParams = {
    fov: 75,
    aspect: canvas.clientWidth / canvas.clientHeight,
    near: 0.1,
    far: 1000,
  }
  const camera = yield* cameraService.create(cameraParams)

  // Position camera
  const cameraPosition = makeVector3(0, 5, 10)
  yield* Effect.sync(() => {
    camera.position.set(cameraPosition.x, cameraPosition.y, cameraPosition.z)
    camera.lookAt(zero.x, zero.y, zero.z)
  })

  // Create 5 blocks using BlockMeshService
  // Block types: DIRT, STONE, WOOD, GRASS, SAND (excluding AIR)
  const blockColors: Record<string, string> = {
    DIRT: '#8B4513',
    STONE: '#808080',
    WOOD: '#A0522D',
    GRASS: '#228B22',
    SAND: '#F4A460',
  }

  const blockPositions = [
    { x: -2, y: 0, z: 0 },  // DIRT
    { x: -1, y: 0, z: 0 },  // STONE
    { x: 0, y: 0, z: 0 },   // WOOD
    { x: 1, y: 0, z: 0 },   // GRASS
    { x: 2, y: 0, z: 0 },   // SAND
  ]

  const blockTypes = ['DIRT', 'STONE', 'WOOD', 'GRASS', 'SAND']

  // Create blocks and add to scene
  const blockMeshes = yield* Effect.forEach(
    blockTypes,
    (blockType, i) =>
      Effect.gen(function* () {
        const position = blockPositions[i]
        const color = blockColors[blockType]

        const mesh = yield* blockMeshService.createSolidBlockMesh(
          color,
          new THREE.Vector3(position.x, position.y, position.z)
        )
        yield* sceneService.add(scene, mesh)
        return mesh
      })
  )

  // Add directional light
  const light = new THREE.DirectionalLight(0xffffff, 1)
  light.position.set(5, 10, 7)
  yield* sceneService.add(scene, light)

  // Add ambient light
  const ambientLight = new THREE.AmbientLight(0x404040, 0.5)
  yield* sceneService.add(scene, ambientLight)

  // FPS overlay element
  const fpsElement = document.getElementById('fps-value')
  let lastTime = performance.now()

  // Rendering loop with object pooling and FPS counter
  const gameLoop = () => {
    // Calculate delta time for FPS counter
    const currentTime = performance.now()
    const deltaTime = (currentTime - lastTime) / 1000 // Convert to seconds
    lastTime = currentTime

    // Update FPS counter (run as sync since it's just a ref update)
    Effect.runSync(
      fpsCounter.tick(deltaTime).pipe(
        Effect.flatMap(() => fpsCounter.getFPS()),
        Effect.map((fps) => {
          if (fpsElement) {
            fpsElement.textContent = fps.toFixed(1)
          }
        })
      )
    )

    // Acquire temporary vectors from pool instead of creating new ones
    const tempVector = Vector3Pool.acquire()
    const tempQuaternion = QuaternionPool.acquire()

    try {
      // Render using pooled objects
      renderer.render(scene, camera)
    } finally {
      // Always release pooled objects back to pool
      Vector3Pool.release(tempVector)
      QuaternionPool.release(tempQuaternion)
    }

    // Request next frame
    requestAnimationFrame(gameLoop)
  }

  // Start loop
  requestAnimationFrame(gameLoop)

  yield* Effect.log('Game loop started with 5 blocks')
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
