import { Effect, Option } from 'effect'
import * as THREE from 'three'

/** Creates a world renderer fake with inert scene and water operations. */
export const makeWorldRendererService = () => ({
  syncChunksToScene: (_chunks: unknown, _scene: unknown) => Effect.succeed(true as boolean),
  applyFrustumCulling: (_camera: unknown) => Effect.void,
  updateChunkInScene: (_chunk: unknown, _scene: unknown) => Effect.void,
  clearScene: (_scene: unknown) => Effect.void,
  doRefractionPrePass: (_renderer: unknown, _scene: unknown, _camera: unknown) => Effect.void,
  updateWaterUniforms: (_time: number, _cameraPosition: unknown) => Effect.void,
  updateWaterResolution: (_width: number, _height: number) => Effect.void,
  resizeRefractionRT: (_width: number, _height: number) => Effect.void,
  resizeRefractionCamera: (_aspect: number) => Effect.void,
  getWaterMeshes: () => Effect.succeed([] as THREE.Mesh[]),
  getSceneVersion: () => Effect.succeed(0),
  setRefractionValid: (_valid: boolean) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/rendering').WorldRendererService>

/** Creates an entity renderer fake that tracks no scene groups. */
export const makeEntityRenderer = () => ({
  syncEntities: (_entities: unknown, _scene: unknown) => Effect.void,
  updateEntityTransforms: (_entities: unknown, _total: unknown, _delta: unknown) => Effect.void,
  clearScene: (_scene: unknown) => Effect.void,
  _getTrackedGroup: (_id: unknown) => Effect.succeed(Option.none()),
}) as unknown as InstanceType<typeof import('@ts-minecraft/rendering').EntityRendererService>

/** Creates a chunk mesh service fake for sunlight updates. */
export const makeChunkMeshService = () => ({
  setSunIntensity: (_value: number) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/rendering').ChunkMeshService>

/** Creates an inert particle system fake that avoids real InstancedMesh and texture setup. */
export const makeParticleSystem = () => ({
  attach: (_scene: unknown) => Effect.void,
  spawnBurst: (_x: number, _y: number, _z: number, _u: number, _v: number, _count?: number) => Effect.void,
  update: (_dtSecs: number) => Effect.void,
  getActiveCount: () => Effect.succeed(0),
}) as unknown as InstanceType<typeof import('@ts-minecraft/rendering/particles/particle-system').ParticleSystemService>

/** Creates a no-op performance HUD fake. */
export const makePerfHud = () => ({
  recordFrame: (_dtSecs: number) => Effect.void,
  setWorkerQueueDepth: (_n: number) => Effect.void,
  setChunkCount: (_n: number) => Effect.void,
  setDrawCalls: (_n: number) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/rendering').PerfHudService>
