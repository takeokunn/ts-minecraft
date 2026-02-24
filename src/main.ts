import { Effect, Layer } from 'effect'

// Import services
import { RendererService, RendererServiceLive } from '@/infrastructure/three/renderer/renderer-service'
import { SceneService, SceneServiceLive } from '@/infrastructure/three/scene/scene-service'
import { PerspectiveCameraService, PerspectiveCameraServiceLive } from '@/infrastructure/three/camera/perspective'

// Import core types from shared math layer for DDD purity
import { makeVector3, zero } from '@/infrastructure/three/core'

// Import object pools
import { Vector3Pool, QuaternionPool } from '@/shared/pool'

// Main Layer composition
// Note: Physics services (PhysicsWorldService, RigidBodyService) will be added in Phase 2
const MainLive = Layer.mergeAll(
  RendererServiceLive,
  SceneServiceLive,
  PerspectiveCameraServiceLive,
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

  // Rendering loop with object pooling
  const gameLoop = () => {
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

  yield* Effect.log('Game loop started')
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
