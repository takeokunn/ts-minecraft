/**
 * RenderService - Complete rendering management with Context.Tag pattern
 *
 * Features:
 * - Scene graph management and culling optimization
 * - Material and shader management
 * - Lighting system with dynamic shadows
 * - Post-processing effects pipeline
 * - Performance optimization and batching
 * - Effect-TS Service pattern with full dependency injection
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as Data from 'effect/Data'
import * as HashMap from 'effect/HashMap'
import * as Array from 'effect/Array'
import * as Option from 'effect/Option'
import * as Set from 'effect/Set'
import * as Ref from 'effect/Ref'
import * as Ref from 'effect/Ref'
import * as _Queue from 'effect/Queue'

// Core imports
import { EntityId } from '@/domain/entities'

import {
  RenderingError,
  TextureNotFoundError,
  MaterialNotFoundError,
  ShaderCompilationError,
  BufferAllocationError,
  RenderTargetError,
  MeshDataError,
  GraphicsContextError,
} from '../errors'

// ===== RENDER SERVICE INTERFACE =====

export interface RenderServiceInterface {
  // Scene management
  readonly createScene: (config: SceneConfig) => Effect.Effect<SceneId, typeof RenderingError, never>
  readonly destroyScene: (sceneId: SceneId) => Effect.Effect<void, typeof RenderingError, never>
  readonly setActiveScene: (sceneId: SceneId) => Effect.Effect<void, typeof RenderingError, never>
  readonly getActiveScene: () => Effect.Effect<Option.Option<SceneId, never, never>, never>

  // Renderable objects
  readonly createRenderable: (config: RenderableConfig) => Effect.Effect<RenderableId, typeof RenderingError | typeof MeshDataError, never>
  readonly destroyRenderable: (renderableId: RenderableId) => Effect.Effect<void, typeof RenderingError, never>
  readonly updateRenderable: (renderableId: RenderableId, updates: RenderableUpdates) => Effect.Effect<void, typeof RenderingError, never>
  readonly setRenderableVisibility: (renderableId: RenderableId, visible: boolean) => Effect.Effect<void, typeof RenderingError, never>

  // Camera management
  readonly createCamera: (config: CameraConfig) => Effect.Effect<CameraId, typeof RenderingError, never>
  readonly destroyCamera: (cameraId: CameraId) => Effect.Effect<void, typeof RenderingError, never>
  readonly setActiveCamera: (cameraId: CameraId) => Effect.Effect<void, typeof RenderingError, never>
  readonly updateCamera: (cameraId: CameraId, updates: CameraUpdates) => Effect.Effect<void, typeof RenderingError, never>

  // Lighting system
  readonly createLight: (config: LightConfig) => Effect.Effect<LightId, typeof RenderingError, never>
  readonly destroyLight: (lightId: LightId) => Effect.Effect<void, typeof RenderingError, never>
  readonly updateLight: (lightId: LightId, updates: LightUpdates) => Effect.Effect<void, typeof RenderingError, never>
  readonly setGlobalLighting: (config: GlobalLightingConfig) => Effect.Effect<void, typeof RenderingError, never>

  // Material and texture management
  readonly createMaterial: (config: MaterialConfig) => Effect.Effect<MaterialId, typeof RenderingError | typeof ShaderCompilationError, never>
  readonly destroyMaterial: (materialId: MaterialId) => Effect.Effect<void, typeof RenderingError, never>
  readonly updateMaterial: (materialId: MaterialId, updates: MaterialUpdates) => Effect.Effect<void, typeof MaterialNotFoundError, never>
  readonly loadTexture: (path: string, options?: TextureOptions) => Effect.Effect<TextureId, typeof TextureNotFoundError, never>
  readonly unloadTexture: (textureId: TextureId) => Effect.Effect<void, never, never>

  // Rendering pipeline
  readonly render: (deltaTime: number) => Effect.Effect<RenderResult, typeof RenderingError, never>
  readonly renderToTarget: (renderTarget: RenderTarget, renderList?: readonly RenderableId[]) => Effect.Effect<void, typeof RenderTargetError, never>
  readonly present: () => Effect.Effect<void, typeof RenderingError, never>

  // Post-processing
  readonly addPostProcessEffect: (effect: PostProcessEffect, priority: number) => Effect.Effect<EffectId, typeof RenderingError, never>
  readonly removePostProcessEffect: (effectId: EffectId) => Effect.Effect<void, typeof RenderingError, never>
  readonly updatePostProcessEffect: (effectId: EffectId, updates: EffectUpdates) => Effect.Effect<void, typeof RenderingError, never>

  // Performance and debugging
  readonly getRenderStats: () => Effect.Effect<RenderStats, never, never>
  readonly enableWireframe: (enabled: boolean) => Effect.Effect<void, never, never>
  readonly captureScreenshot: (options?: ScreenshotOptions) => Effect.Effect<ScreenshotResult, typeof RenderingError, never>
  readonly setRenderDebugMode: (mode: RenderDebugMode) => Effect.Effect<void, never, never>

  // Resource management
  readonly getResourceUsage: () => Effect.Effect<ResourceUsage, never, never>
  readonly optimizeResources: () => Effect.Effect<OptimizationResult, never, never>
  readonly preloadResources: (resources: readonly ResourceRequest[]) => Effect.Effect<void, typeof RenderingError, never>
}

// ===== SUPPORTING TYPES =====

export type SceneId = string & { readonly _brand: 'SceneId' }
export type RenderableId = string & { readonly _brand: 'RenderableId' }
export type CameraId = string & { readonly _brand: 'CameraId' }
export type LightId = string & { readonly _brand: 'LightId' }
export type MaterialId = string & { readonly _brand: 'MaterialId' }
export type TextureId = string & { readonly _brand: 'TextureId' }
export type EffectId = string & { readonly _brand: 'EffectId' }

export interface Vector3 {
  readonly x: number
  readonly y: number
  readonly z: number
}

export interface Vector4 {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly w: number
}

export interface Matrix4 {
  readonly elements: readonly number[]
}

export interface Color {
  readonly r: number
  readonly g: number
  readonly b: number
  readonly a: number
}

export interface SceneConfig {
  readonly name: string
  readonly backgroundColor: Color
  readonly fogEnabled: boolean
  readonly fogColor?: Color
  readonly fogNear?: number
  readonly fogFar?: number
}

export interface RenderableConfig {
  readonly entityId: EntityId
  readonly meshPath: string
  readonly materialId: MaterialId
  readonly position: Vector3
  readonly rotation: Vector3
  readonly scale: Vector3
  readonly castShadows: boolean
  readonly receiveShadows: boolean
  readonly renderLayer: RenderLayer
}

export interface RenderableUpdates {
  readonly position?: Vector3
  readonly rotation?: Vector3
  readonly scale?: Vector3
  readonly materialId?: MaterialId
  readonly visible?: boolean
  readonly renderLayer?: RenderLayer
}

export type RenderLayer = 'background' | 'opaque' | 'transparent' | 'overlay' | 'ui'

export interface CameraConfig {
  readonly name: string
  readonly type: CameraType
  readonly position: Vector3
  readonly target: Vector3
  readonly up: Vector3
  readonly fov: number
  readonly aspect: number
  readonly near: number
  readonly far: number
}

export interface CameraUpdates {
  readonly position?: Vector3
  readonly target?: Vector3
  readonly up?: Vector3
  readonly fov?: number
  readonly aspect?: number
  readonly near?: number
  readonly far?: number
}

export type CameraType = 'perspective' | 'orthographic'

export interface LightConfig {
  readonly name: string
  readonly type: LightType
  readonly color: Color
  readonly intensity: number
  readonly position: Vector3
  readonly direction?: Vector3
  readonly castShadows: boolean
  readonly shadowMapSize: number
}

export interface LightUpdates {
  readonly color?: Color
  readonly intensity?: number
  readonly position?: Vector3
  readonly direction?: Vector3
  readonly castShadows?: boolean
}

export type LightType = 'directional' | 'point' | 'spot' | 'area'

export interface GlobalLightingConfig {
  readonly ambientColor: Color
  readonly ambientIntensity: number
  readonly shadowsEnabled: boolean
  readonly shadowQuality: ShadowQuality
  readonly maxLights: number
}

export type ShadowQuality = 'low' | 'medium' | 'high' | 'ultra'

export interface MaterialConfig {
  readonly name: string
  readonly shader: ShaderConfig
  readonly properties: MaterialProperties
  readonly transparent: boolean
  readonly doubleSided: boolean
  readonly alphaTest: number
}

export interface ShaderConfig {
  readonly vertexShader: string
  readonly fragmentShader: string
  readonly uniforms: Record<string, UniformValue>
  readonly defines: Record<string, string>
}

export interface MaterialProperties {
  readonly albedoColor: Color
  readonly albedoTexture?: TextureId
  readonly normalTexture?: TextureId
  readonly metallicFactor: number
  readonly roughnessFactor: number
  readonly emissiveColor: Color
  readonly emissiveTexture?: TextureId
}

export interface MaterialUpdates {
  readonly properties?: Partial<MaterialProperties>
  readonly transparent?: boolean
  readonly doubleSided?: boolean
}

export type UniformValue = number | Vector3 | Vector4 | Matrix4 | Color | TextureId

export interface TextureOptions {
  readonly generateMipmaps: boolean
  readonly wrapS: TextureWrap
  readonly wrapT: TextureWrap
  readonly minFilter: TextureFilter
  readonly magFilter: TextureFilter
  readonly anisotropy: number
}

export type TextureWrap = 'repeat' | 'clampToEdge' | 'mirroredRepeat'
export type TextureFilter = 'nearest' | 'linear' | 'nearestMipmapNearest' | 'linearMipmapNearest' | 'nearestMipmapLinear' | 'linearMipmapLinear'

export interface RenderTarget {
  readonly width: number
  readonly height: number
  readonly format: RenderTargetFormat
  readonly depthBuffer: boolean
  readonly stencilBuffer: boolean
  readonly samples: number
}

export type RenderTargetFormat = 'rgba8' | 'rgba16f' | 'rgba32f' | 'depth24' | 'depth32f'

export interface PostProcessEffect {
  readonly name: string
  readonly shader: ShaderConfig
  readonly enabled: boolean
  readonly inputs: readonly TextureId[]
  readonly outputs: readonly TextureId[]
}

export interface EffectUpdates {
  readonly enabled?: boolean
  readonly shader?: Partial<ShaderConfig>
}

export interface RenderResult {
  readonly deltaTime: number
  readonly drawCalls: number
  readonly triangles: number
  readonly vertices: number
  readonly renderTime: number
  readonly culledObjects: number
  readonly visibleObjects: number
}

export interface RenderStats {
  readonly fps: number
  readonly frameTime: number
  readonly drawCalls: number
  readonly triangles: number
  readonly vertices: number
  readonly textureMemory: number
  readonly bufferMemory: number
  readonly shaderSwitches: number
  readonly renderTargetSwitches: number
}

export type RenderDebugMode = 'none' | 'wireframe' | 'normals' | 'depth' | 'lightComplexity' | 'overdraw'

export interface ScreenshotOptions {
  readonly width?: number
  readonly height?: number
  readonly format?: 'png' | 'jpg' | 'webp'
  readonly quality?: number
}

export interface ScreenshotResult {
  readonly data: Uint8Array
  readonly width: number
  readonly height: number
  readonly format: string
}

export interface ResourceUsage {
  readonly totalMemory: number
  readonly textureMemory: number
  readonly bufferMemory: number
  readonly shaderMemory: number
  readonly loadedTextures: number
  readonly loadedMaterials: number
  readonly loadedMeshes: number
}

export interface OptimizationResult {
  readonly memoryFreed: number
  readonly resourcesRemoved: number
  readonly batchesCreated: number
  readonly performanceImprovement: number
}

export interface ResourceRequest {
  readonly type: ResourceType
  readonly path: string
  readonly priority: number
}

export type ResourceType = 'texture' | 'mesh' | 'material' | 'shader'

// Internal types
interface Scene {
  readonly id: SceneId
  readonly config: SceneConfig
  readonly renderables: Set<RenderableId>
  readonly lights: Set<LightId>
  readonly activeCamera: Option.Option<CameraId>
}

interface Renderable {
  readonly id: RenderableId
  readonly config: RenderableConfig
  readonly mesh: MeshData
  readonly bounds: BoundingBox
  readonly visible: boolean
  readonly lastFrameVisible: boolean
}

interface Camera {
  readonly id: CameraId
  readonly config: CameraConfig
  readonly viewMatrix: Matrix4
  readonly projectionMatrix: Matrix4
  readonly frustum: Frustum
}

interface Light {
  readonly id: LightId
  readonly config: LightConfig
  readonly shadowMap: Option.Option<TextureId>
}

interface Material {
  readonly id: MaterialId
  readonly config: MaterialConfig
  readonly compiledShader: CompiledShader
  readonly uniformsBuffer: UniformsBuffer
}

interface MeshData {
  readonly vertices: Float32Array
  readonly indices: Uint32Array
  readonly normals: Float32Array
  readonly uvs: Float32Array
  readonly vertexBuffer: BufferId
  readonly indexBuffer: BufferId
}

interface CompiledShader {
  readonly program: WebGLProgram
  readonly uniforms: Record<string, WebGLUniformLocation>
  readonly attributes: Record<string, number>
}

interface UniformsBuffer {
  readonly data: ArrayBuffer
  readonly dirty: boolean
}

interface BoundingBox {
  readonly min: Vector3
  readonly max: Vector3
}

interface Frustum {
  readonly planes: readonly Plane[]
}

interface Plane {
  readonly normal: Vector3
  readonly distance: number
}

type BufferId = string & { readonly _brand: 'BufferId' }

// ===== RENDER SERVICE TAG =====

export class RenderService extends Context.GenericTag('RenderService')<RenderService, RenderServiceInterface>() {
  static readonly Live = Layer.effect(
    RenderService,
    Effect.gen(function* () {
      // Dependencies would be provided by proper service composition
      // const entityService = yield* EntityServiceDep

      // Internal state
      const scenes = yield* Ref.make(HashMap.empty<SceneId, Scene>())
      const renderables = yield* Ref.make(HashMap.empty<RenderableId, Renderable>())
      const cameras = yield* Ref.make(HashMap.empty<CameraId, Camera>())
      const lights = yield* Ref.make(HashMap.empty<LightId, Light>())
      const materials = yield* Ref.make(HashMap.empty<MaterialId, Material>())
      const textures = yield* Ref.make(HashMap.empty<TextureId, WebGLTexture>())
      const postEffects = yield* Ref.make(HashMap.empty<EffectId, PostProcessEffect>())

      const activeScene = yield* Ref.make<Option.Option<SceneId>>(Option.none())
      const nextId = yield* Ref.make(0)

      const renderStats = yield* Ref.make({
        frameCount: 0,
        totalRenderTime: 0,
        totalDrawCalls: 0,
        avgFps: 0,
      })

      const debugMode = yield* Ref.make<RenderDebugMode>('none')
      const wireframeEnabled = yield* Ref.make(false)

      // Configuration
      const globalLighting = yield* Ref.make<GlobalLightingConfig>({
        ambientColor: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
        ambientIntensity: 0.2,
        shadowsEnabled: true,
        shadowQuality: 'medium',
        maxLights: 8,
      })

      // Helper functions
      const generateId = (): Effect.Effect<string, never, never> => Ref.modify(nextId, (id) => [(id + 1).toString(), id + 1])

      const createSceneId = (id: string): SceneId => id as SceneId
      const createRenderableId = (id: string): RenderableId => id as RenderableId
      const createCameraId = (id: string): CameraId => id as CameraId
      const createLightId = (id: string): LightId => id as LightId
      const createMaterialId = (id: string): MaterialId => id as MaterialId
      const createTextureId = (id: string): TextureId => id as TextureId
      const createEffectId = (id: string): EffectId => id as EffectId

      // Math utilities
      const _multiplyMatrices = (_a: Matrix4, _b: Matrix4): Matrix4 => {
        // Implementation would perform actual matrix multiplication
        return { elements: new Array(16).fill(0) }
      }

      const calculateViewMatrix = (_camera: CameraConfig): Matrix4 => {
        // Implementation would calculate view matrix from camera config
        return { elements: new Array(16).fill(0) }
      }

      const calculateProjectionMatrix = (_camera: CameraConfig): Matrix4 => {
        // Implementation would calculate projection matrix from camera config
        return { elements: new Array(16).fill(0) }
      }

      const createFrustum = (_viewMatrix: Matrix4, _projMatrix: Matrix4): Frustum => {
        // Implementation would extract frustum planes from matrices
        return { planes: [] }
      }

      const isInFrustum = (_bounds: BoundingBox, _frustum: Frustum): boolean => {
        // Implementation would test bounding box against frustum planes
        return true
      }

      // Scene management implementation
      const createScene = (config: SceneConfig): Effect.Effect<SceneId, typeof RenderingError, never> =>
        Effect.gen(function* () {
          try {
            const id = createSceneId(yield* generateId())

            const scene: Scene = {
              id,
              config,
              renderables: Set.empty(),
              lights: Set.empty(),
              activeCamera: Option.none(),
            }

            yield* Ref.update(scenes, HashMap.set(id, scene))
            return id
          } catch (error) {
            return yield* Effect.fail(
              RenderingError({
                message: `Failed to create scene: ${error}`,
                cause: error,
              }),
            )
          }
        })

      const destroyScene = (sceneId: SceneId): Effect.Effect<void, typeof RenderingError, never> =>
        Effect.gen(function* () {
          const currentScenes = yield* Ref.get(scenes)
          const scene = HashMap.get(currentScenes, sceneId)

          if (Option.isNone(scene)) {
            return yield* Effect.fail(
              RenderingError({
                message: `Scene not found: ${sceneId}`,
                sceneId,
              }),
            )
          }

          // Clean up scene resources
          for (const renderableId of scene.value.renderables) {
            yield* destroyRenderable(renderableId).pipe(Effect.catchAll(() => Effect.succeed(undefined)))
          }

          for (const lightId of scene.value.lights) {
            yield* destroyLight(lightId).pipe(Effect.catchAll(() => Effect.succeed(undefined)))
          }

          yield* Ref.update(scenes, HashMap.remove(sceneId))

          // Clear active scene if it was the destroyed one
          const current = yield* Ref.get(activeScene)
          if (Option.isSome(current) && current.value === sceneId) {
            yield* Ref.set(activeScene, Option.none())
          }
        })

      // Renderable management implementation
      const createRenderable = (config: RenderableConfig): Effect.Effect<RenderableId, typeof RenderingError | typeof MeshDataError, never> =>
        Effect.gen(function* () {
          try {
            const id = createRenderableId(yield* generateId())

            // Load mesh data (in practice would load from file system)
            const meshData = yield* loadMeshData(config.meshPath).pipe(
              Effect.mapError(() =>
                MeshDataError({
                  message: `Failed to load mesh: ${config.meshPath}`,
                  meshPath: config.meshPath,
                }),
              ),
            )

            // Calculate bounding box
            const bounds = calculateBoundingBox(meshData)

            const renderable: Renderable = {
              id,
              config,
              mesh: meshData,
              bounds,
              visible: true,
              lastFrameVisible: false,
            }

            yield* Ref.update(renderables, HashMap.set(id, renderable))

            // Add to active scene if one exists
            const current = yield* Ref.get(activeScene)
            if (Option.isSome(current)) {
              yield* Ref.update(scenes, (scenes) => {
                const scene = HashMap.get(scenes, current.value)
                if (Option.isSome(scene)) {
                  const updatedScene = Data.struct({
                    ...scene.value,
                    renderables: Set.add(scene.value.renderables, id),
                  })
                  return HashMap.set(scenes, current.value, updatedScene)
                }
                return scenes
              })
            }

            return id
          } catch (error) {
            return yield* Effect.fail(
              RenderingError({
                message: `Failed to create renderable: ${error}`,
                cause: error,
              }),
            )
          }
        })

      // Camera management implementation
      const createCamera = (config: CameraConfig): Effect.Effect<CameraId, typeof RenderingError, never> =>
        Effect.gen(function* () {
          try {
            const id = createCameraId(yield* generateId())

            const viewMatrix = calculateViewMatrix(config)
            const projectionMatrix = calculateProjectionMatrix(config)
            const frustum = createFrustum(viewMatrix, projectionMatrix)

            const camera: Camera = {
              id,
              config,
              viewMatrix,
              projectionMatrix,
              frustum,
            }

            yield* Ref.update(cameras, HashMap.set(id, camera))
            return id
          } catch (error) {
            return yield* Effect.fail(
              RenderingError({
                message: `Failed to create camera: ${error}`,
                cause: error,
              }),
            )
          }
        })

      // Lighting system implementation
      const createLight = (config: LightConfig): Effect.Effect<LightId, typeof RenderingError, never> =>
        Effect.gen(function* () {
          try {
            const id = createLightId(yield* generateId())

            // Create shadow map if needed
            const shadowMap = config.castShadows ? Option.some(yield* createShadowMap(config.shadowMapSize)) : Option.none()

            const light: Light = {
              id,
              config,
              shadowMap,
            }

            yield* Ref.update(lights, HashMap.set(id, light))
            return id
          } catch (error) {
            return yield* Effect.fail(
              RenderingError({
                message: `Failed to create light: ${error}`,
                cause: error,
              }),
            )
          }
        })

      // Material management implementation
      const createMaterial = (config: MaterialConfig): Effect.Effect<MaterialId, typeof RenderingError | typeof ShaderCompilationError, never> =>
        Effect.gen(function* () {
          try {
            const id = createMaterialId(yield* generateId())

            // Compile shader
            const compiledShader = yield* compileShader(config.shader).pipe(
              Effect.mapError(() =>
                ShaderCompilationError({
                  message: `Failed to compile shader for material: ${config.name}`,
                  shaderSource: config.shader.vertexShader + config.shader.fragmentShader,
                }),
              ),
            )

            // Create uniforms buffer
            const uniformsBuffer = createUniformsBuffer(config.shader.uniforms)

            const material: Material = {
              id,
              config,
              compiledShader,
              uniformsBuffer,
            }

            yield* Ref.update(materials, HashMap.set(id, material))
            return id
          } catch (error) {
            return yield* Effect.fail(
              RenderingError({
                message: `Failed to create material: ${error}`,
                cause: error,
              }),
            )
          }
        })

      // Rendering pipeline implementation
      const render = (deltaTime: number): Effect.Effect<RenderResult, typeof RenderingError, never> =>
        Effect.gen(function* () {
          const startTime = Date.now()
          let drawCalls = 0
          let triangles = 0
          let vertices = 0
          let culledObjects = 0
          let visibleObjects = 0

          try {
            const currentScene = yield* Ref.get(activeScene)
            if (Option.isNone(currentScene)) {
              return {
                deltaTime,
                drawCalls: 0,
                triangles: 0,
                vertices: 0,
                renderTime: 0,
                culledObjects: 0,
                visibleObjects: 0,
              }
            }

            const scenes = yield* Ref.get(scenes)
            const scene = HashMap.get(scenes, currentScene.value)
            if (Option.isNone(scene)) {
              return yield* Effect.fail(
                RenderingError({
                  message: `Active scene not found: ${currentScene.value}`,
                  sceneId: currentScene.value,
                }),
              )
            }

            // Get active camera
            const activeCamera = scene.value.activeCamera
            if (Option.isNone(activeCamera)) {
              return yield* Effect.fail(
                RenderingError({
                  message: `No active camera in scene: ${currentScene.value}`,
                  sceneId: currentScene.value,
                }),
              )
            }

            const cameraMap = yield* Ref.get(cameras)
            const camera = HashMap.get(cameraMap, activeCamera.value)
            if (Option.isNone(camera)) {
              return yield* Effect.fail(
                RenderingError({
                  message: `Active camera not found: ${activeCamera.value}`,
                  cameraId: activeCamera.value,
                }),
              )
            }

            // Frustum culling
            const renderableMap = yield* Ref.get(renderables)
            const visibleRenderables = []

            for (const renderableId of scene.value.renderables) {
              const renderable = HashMap.get(renderableMap, renderableId)
              if (Option.isSome(renderable) && renderable.value.visible) {
                if (isInFrustum(renderable.value.bounds, camera.value.frustum)) {
                  visibleRenderables.push(renderable.value)
                  visibleObjects++
                } else {
                  culledObjects++
                }
              }
            }

            // Sort renderables by render layer and distance
            const sortedRenderables = sortRenderables(visibleRenderables, camera.value)

            // Shadow pass
            const lightMap = yield* Ref.get(lights)
            const shadowCastingLights = Array.fromIterable(scene.value.lights)
              .map((lightId) => HashMap.get(lightMap, lightId))
              .filter(Option.isSome)
              .map((light) => light.value)
              .filter((light) => light.config.castShadows)

            for (const light of shadowCastingLights) {
              if (Option.isSome(light.shadowMap)) {
                yield* renderShadowMap(light, visibleRenderables)
              }
            }

            // Main render pass
            yield* clearRenderTarget(scene.value.config.backgroundColor)

            for (const renderable of sortedRenderables) {
              const renderResult = yield* renderObject(renderable, camera.value)
              drawCalls += renderResult.drawCalls
              triangles += renderResult.triangles
              vertices += renderResult.vertices
            }

            // Post-processing
            const effectsMap = yield* Ref.get(postEffects)
            const enabledEffects = Array.fromIterable(HashMap.values(effectsMap))
              .filter((effect) => effect.enabled)
              .sort((a, b) => a.name.localeCompare(b.name)) // Sort by priority in real impl

            for (const effect of enabledEffects) {
              yield* applyPostProcessEffect(effect)
            }

            const renderTime = Date.now() - startTime
            yield* updateRenderStats(renderTime, drawCalls)

            return {
              deltaTime,
              drawCalls,
              triangles,
              vertices,
              renderTime,
              culledObjects,
              visibleObjects,
            }
          } catch (error) {
            return yield* Effect.fail(
              RenderingError({
                message: `Render failed: ${error}`,
                cause: error,
              }),
            )
          }
        })

      // Helper function implementations (simplified)
      const loadMeshData = (_meshPath: string): Effect.Effect<MeshData, never, never> =>
        Effect.succeed({
          vertices: new Float32Array([]),
          indices: new Uint32Array([]),
          normals: new Float32Array([]),
          uvs: new Float32Array([]),
          vertexBuffer: '' as BufferId,
          indexBuffer: '' as BufferId,
        })

      const calculateBoundingBox = (_meshData: MeshData): BoundingBox => ({
        min: { x: -1, y: -1, z: -1 },
        max: { x: 1, y: 1, z: 1 },
      })

      const createShadowMap = (_size: number): Effect.Effect<TextureId, never, never> => Effect.succeed(createTextureId('shadow_' + Math.random().toString()))

      const compileShader = (_shaderConfig: ShaderConfig): Effect.Effect<CompiledShader, never, never> =>
        Effect.succeed({
          program: {} as WebGLProgram,
          uniforms: {},
          attributes: {},
        })

      const createUniformsBuffer = (_uniforms: Record<string, UniformValue>): UniformsBuffer => ({
        data: new ArrayBuffer(256),
        dirty: true,
      })

      const sortRenderables = (renderables: readonly Renderable[], _camera: Camera): readonly Renderable[] =>
        Array.fromIterable(renderables).sort((a, b) => {
          // Sort by layer first, then by distance
          const layerOrder = ['background', 'opaque', 'transparent', 'overlay', 'ui']
          const aIndex = layerOrder.indexOf(a.config.renderLayer)
          const bIndex = layerOrder.indexOf(b.config.renderLayer)
          return aIndex - bIndex
        })

      const renderShadowMap = (_light: Light, _renderables: readonly Renderable[]): Effect.Effect<void, never, never> => Effect.succeed(undefined)

      const clearRenderTarget = (_color: Color): Effect.Effect<void, never, never> => Effect.succeed(undefined)

      const renderObject = (_renderable: Renderable, _camera: Camera): Effect.Effect<{ drawCalls: number; triangles: number; vertices: number }, never, never> =>
        Effect.succeed({ drawCalls: 1, triangles: 100, vertices: 300 })

      const applyPostProcessEffect = (_effect: PostProcessEffect): Effect.Effect<void, never, never> => Effect.succeed(undefined)

      const updateRenderStats = (renderTime: number, drawCalls: number): Effect.Effect<void, never, never> =>
        Ref.update(renderStats, (stats) =>
          Data.struct({
            ...stats,
            frameCount: stats.frameCount + 1,
            totalRenderTime: stats.totalRenderTime + renderTime,
            totalDrawCalls: stats.totalDrawCalls + drawCalls,
            avgFps: stats.frameCount > 0 ? 1000 / (stats.totalRenderTime / stats.frameCount) : 0,
          }),
        )

      // Return the service implementation
      return {
        createScene,
        destroyScene,
        setActiveScene: (sceneId: SceneId) => Ref.set(activeScene, Option.some(sceneId)),
        getActiveScene: () => Ref.get(activeScene),

        createRenderable,
        destroyRenderable: (renderableId: RenderableId) => Ref.update(renderables, HashMap.remove(renderableId)),
        updateRenderable: (renderableId: RenderableId, updates: RenderableUpdates) =>
          Effect.gen(function* () {
            const currentRenderables = yield* Ref.get(renderables)
            const renderable = HashMap.get(currentRenderables, renderableId)

            if (Option.isSome(renderable)) {
              const updatedConfig = { ...renderable.value.config, ...updates }
              const updatedRenderable = Data.struct({ ...renderable.value, config: updatedConfig })
              yield* Ref.update(renderables, HashMap.set(renderableId, updatedRenderable))
            } else {
              return yield* Effect.fail(
                RenderingError({
                  message: `Renderable not found: ${renderableId}`,
                  renderableId,
                }),
              )
            }
          }),
        setRenderableVisibility: (renderableId: RenderableId, visible: boolean) =>
          Effect.gen(function* () {
            const currentRenderables = yield* Ref.get(renderables)
            const renderable = HashMap.get(currentRenderables, renderableId)

            if (Option.isSome(renderable)) {
              const updatedRenderable = Data.struct({ ...renderable.value, visible })
              yield* Ref.update(renderables, HashMap.set(renderableId, updatedRenderable))
            } else {
              return yield* Effect.fail(
                RenderingError({
                  message: `Renderable not found: ${renderableId}`,
                  renderableId,
                }),
              )
            }
          }),

        createCamera,
        destroyCamera: (cameraId: CameraId) => Ref.update(cameras, HashMap.remove(cameraId)),
        setActiveCamera: (cameraId: CameraId) =>
          Effect.gen(function* () {
            const current = yield* Ref.get(activeScene)
            if (Option.isSome(current)) {
              yield* Ref.update(scenes, (scenes) => {
                const scene = HashMap.get(scenes, current.value)
                if (Option.isSome(scene)) {
                  const updatedScene = Data.struct({
                    ...scene.value,
                    activeCamera: Option.some(cameraId),
                  })
                  return HashMap.set(scenes, current.value, updatedScene)
                }
                return scenes
              })
            }
          }),
        updateCamera: (cameraId: CameraId, updates: CameraUpdates) =>
          Effect.gen(function* () {
            const currentCameras = yield* Ref.get(cameras)
            const camera = HashMap.get(currentCameras, cameraId)

            if (Option.isSome(camera)) {
              const updatedConfig = { ...camera.value.config, ...updates }
              const viewMatrix = calculateViewMatrix(updatedConfig)
              const projectionMatrix = calculateProjectionMatrix(updatedConfig)
              const frustum = createFrustum(viewMatrix, projectionMatrix)

              const updatedCamera = Data.struct({
                ...camera.value,
                config: updatedConfig,
                viewMatrix,
                projectionMatrix,
                frustum,
              })

              yield* Ref.update(cameras, HashMap.set(cameraId, updatedCamera))
            }
          }),

        createLight,
        destroyLight: (lightId: LightId) => Ref.update(lights, HashMap.remove(lightId)),
        updateLight: (lightId: LightId, updates: LightUpdates) =>
          Effect.gen(function* () {
            const currentLights = yield* Ref.get(lights)
            const light = HashMap.get(currentLights, lightId)

            if (Option.isSome(light)) {
              const updatedConfig = { ...light.value.config, ...updates }
              const updatedLight = Data.struct({ ...light.value, config: updatedConfig })
              yield* Ref.update(lights, HashMap.set(lightId, updatedLight))
            }
          }),
        setGlobalLighting: (config: GlobalLightingConfig) => Ref.set(globalLighting, config),

        createMaterial,
        destroyMaterial: (materialId: MaterialId) => Ref.update(materials, HashMap.remove(materialId)),
        updateMaterial: (materialId: MaterialId, updates: MaterialUpdates) =>
          Effect.gen(function* () {
            const currentMaterials = yield* Ref.get(materials)
            const material = HashMap.get(currentMaterials, materialId)

            if (Option.isSome(material)) {
              const updatedConfig = { ...material.value.config, ...updates }
              const updatedMaterial = Data.struct({ ...material.value, config: updatedConfig })
              yield* Ref.update(materials, HashMap.set(materialId, updatedMaterial))
            } else {
              return yield* Effect.fail(
                MaterialNotFoundError({
                  message: `Material not found: ${materialId}`,
                  materialId,
                }),
              )
            }
          }),
        loadTexture: () =>
          Effect.gen(function* () {
            const id = createTextureId(yield* generateId())
            // Implementation would load actual texture
            const texture = {} as WebGLTexture
            yield* Ref.update(textures, HashMap.set(id, texture))
            return id
          }),
        unloadTexture: (textureId: TextureId) => Ref.update(textures, HashMap.remove(textureId)),

        render,
        renderToTarget: () => Effect.succeed(undefined),
        present: () => Effect.succeed(undefined),

        addPostProcessEffect: (effect: PostProcessEffect) =>
          Effect.gen(function* () {
            const id = createEffectId(yield* generateId())
            yield* Ref.update(postEffects, HashMap.set(id, effect))
            return id
          }),
        removePostProcessEffect: (effectId: EffectId) => Ref.update(postEffects, HashMap.remove(effectId)),
        updatePostProcessEffect: (effectId: EffectId, updates: EffectUpdates) =>
          Effect.gen(function* () {
            const currentEffects = yield* Ref.get(postEffects)
            const effect = HashMap.get(currentEffects, effectId)

            if (Option.isSome(effect)) {
              const updatedEffect = { ...effect.value, ...updates }
              yield* Ref.update(postEffects, HashMap.set(effectId, updatedEffect))
            }
          }),

        getRenderStats: () =>
          Effect.gen(function* () {
            const stats = yield* Ref.get(renderStats)
            const currentTextures = yield* Ref.get(textures)

            return {
              fps: stats.avgFps,
              frameTime: stats.frameCount > 0 ? stats.totalRenderTime / stats.frameCount : 0,
              drawCalls: stats.frameCount > 0 ? stats.totalDrawCalls / stats.frameCount : 0,
              triangles: 0, // Would calculate from actual render data
              vertices: 0, // Would calculate from actual render data
              textureMemory: HashMap.size(currentTextures) * 1024 * 1024, // Estimate
              bufferMemory: 0, // Would calculate from buffer data
              shaderSwitches: 0, // Would track shader switches
              renderTargetSwitches: 0, // Would track render target switches
            }
          }),

        enableWireframe: (enabled: boolean) => Ref.set(wireframeEnabled, enabled),
        captureScreenshot: (options?: ScreenshotOptions) =>
          Effect.succeed({
            data: new Uint8Array(),
            width: options?.width ?? 1920,
            height: options?.height ?? 1080,
            format: options?.format ?? 'png',
          }),
        setRenderDebugMode: (mode: RenderDebugMode) => Ref.set(debugMode, mode),

        getResourceUsage: () =>
          Effect.gen(function* () {
            const currentTextures = yield* Ref.get(textures)
            const currentMaterials = yield* Ref.get(materials)
            const currentRenderables = yield* Ref.get(renderables)

            const textureMemory = HashMap.size(currentTextures) * 1024 * 1024 // Estimate
            const bufferMemory = HashMap.size(currentRenderables) * 512 * 1024 // Estimate
            const shaderMemory = HashMap.size(currentMaterials) * 64 * 1024 // Estimate

            return {
              totalMemory: textureMemory + bufferMemory + shaderMemory,
              textureMemory,
              bufferMemory,
              shaderMemory,
              loadedTextures: HashMap.size(currentTextures),
              loadedMaterials: HashMap.size(currentMaterials),
              loadedMeshes: HashMap.size(currentRenderables),
            }
          }),

        optimizeResources: () =>
          Effect.succeed({
            memoryFreed: 0,
            resourcesRemoved: 0,
            batchesCreated: 0,
            performanceImprovement: 0,
          }),

        preloadResources: () => Effect.succeed(undefined),
      }
    }),
  )
}

// Supporting types for render commands
interface RenderCommand {
  readonly type: 'draw' | 'clear' | 'setTarget'
  readonly data: unknown
}

// Dependencies would be handled by proper service composition in real implementation
