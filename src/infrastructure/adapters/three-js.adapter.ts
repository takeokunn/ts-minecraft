/**
 * Three.js Adapter - Implements rendering operations using Three.js
 *
 * This adapter provides concrete implementation for 3D rendering
 * using Three.js library, isolating the domain layer from specific
 * rendering implementation details.
 */

import * as Effect from 'effect/Effect'
import * as Context from 'effect/Context'
import * as Layer from 'effect/Layer'
import * as Queue from 'effect/Queue'
import * as Ref from 'effect/Ref'
import * as Match from 'effect/Match'
import * as Option from 'effect/Option'
import * as THREE from 'three'
import { 
  IRenderPort, 
  Camera, 
  ChunkMeshData, 
  RenderStats,
  MeshHandle,
  ViewportConfig,
  FogConfig,
  LightingConfig,
  RenderError,
  MeshError,
  CameraError,
  ResourceError
} from '@domain/ports/render.port'

/**
 * Render command types for the rendering queue
 */
export type RenderCommand =
  | {
      readonly type: 'CREATE_MESH'
      readonly meshData: ChunkMeshData
    }
  | {
      readonly type: 'UPDATE_MESH'
      readonly handle: MeshHandle
      readonly meshData: ChunkMeshData
    }
  | {
      readonly type: 'REMOVE_MESH'
      readonly handle: MeshHandle
    }
  | {
      readonly type: 'ADD_CHUNK'
      readonly chunkX: number
      readonly chunkZ: number
      readonly positions: Float32Array
      readonly normals: Float32Array
      readonly uvs: Float32Array
      readonly indices: Uint32Array
    }
  | {
      readonly type: 'REMOVE_CHUNK'
      readonly chunkX: number
      readonly chunkZ: number
    }
  | {
      readonly type: 'UPDATE_CAMERA'
      readonly camera: Camera
    }
  | {
      readonly type: 'RESIZE'
      readonly config: ViewportConfig
    }
  | {
      readonly type: 'SET_FOG'
      readonly config: FogConfig
    }
  | {
      readonly type: 'SET_LIGHTING'
      readonly config: LightingConfig
    }
  | {
      readonly type: 'SET_WIREFRAME'
      readonly enabled: boolean
    }
  | {
      readonly type: 'RENDER_FRAME'
    }
  | {
      readonly type: 'CLEAR'
    }

/**
 * Three.js Context interface for dependency injection
 */
export interface IThreeJsContext {
  readonly scene: THREE.Scene
  readonly camera: THREE.PerspectiveCamera
  readonly renderer: THREE.WebGLRenderer
  readonly canvas: HTMLCanvasElement
}

export const ThreeJsContext = Context.GenericTag<IThreeJsContext>('ThreeJsContext')

/**
 * Three.js Renderer Adapter interface - extends IRenderPort
 */
export interface IThreeJsAdapter extends IRenderPort {
  readonly renderQueue: Queue.Queue<RenderCommand>
  readonly processRenderQueue: () => Effect.Effect<void, RenderError, never>
}

export const ThreeJsAdapter = Context.GenericTag<IThreeJsAdapter>('ThreeJsAdapter')

/**
 * Three.js Adapter implementation
 */
export const ThreeJsAdapterLive = Layer.scoped(
  ThreeJsAdapter,
  Effect.gen(function* (_) {
    const threeJsContext = yield* _(ThreeJsContext)

    const chunkMeshes = yield* _(Ref.make(new Map<string, THREE.Mesh>()))
    const meshHandles = yield* _(Ref.make(new Map<string, THREE.Mesh>()))
    const meshCounter = yield* _(Ref.make(0))
    const currentCamera = yield* _(Ref.make<Camera>({
      position: { x: 0, y: 0, z: 0 },
      rotation: { x: 0, y: 0, z: 0 },
      fov: 75,
      aspect: window.innerWidth / window.innerHeight,
      near: 0.1,
      far: 1000,
    }))
    const renderQueue = yield* _(Queue.unbounded<RenderCommand>())

    // Create basic materials
    const chunkMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00 })
    const wireframeMaterial = new THREE.MeshLambertMaterial({ color: 0x00ff00, wireframe: true })
    const isWireframe = yield* _(Ref.make(false))

    // Add basic lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.4)
    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1, 1, 1)
    threeJsContext.scene.add(ambientLight)
    threeJsContext.scene.add(directionalLight)

    const generateMeshId = () =>
      Effect.gen(function* (_) {
        const count = yield* _(Ref.getAndUpdate(meshCounter, n => n + 1))
        return `mesh_${count}`
      })

    const processCommand = (command: RenderCommand) =>
      Match.value(command).pipe(
        Match.when({ type: 'CREATE_MESH' }, ({ meshData }) =>
          Effect.gen(function* (_) {
            try {
              const geometry = new THREE.BufferGeometry()
              geometry.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3))
              geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3))
              geometry.setAttribute('uv', new THREE.BufferAttribute(meshData.uvs, 2))
              geometry.setIndex(Array.from(meshData.indices))

              const wireframe = yield* _(Ref.get(isWireframe))
              const mesh = new THREE.Mesh(geometry, wireframe ? wireframeMaterial : chunkMaterial)
              mesh.position.set(meshData.chunkX * 16, 0, meshData.chunkZ * 16)

              const id = yield* _(generateMeshId())
              const handle: MeshHandle = { id, chunkX: meshData.chunkX, chunkZ: meshData.chunkZ }

              threeJsContext.scene.add(mesh)
              yield* _(Ref.update(meshHandles, (map) => map.set(handle.id, mesh)))
            } catch (error) {
              yield* _(Effect.fail(new MeshError({
                message: 'Failed to create mesh',
                chunkX: meshData.chunkX,
                chunkZ: meshData.chunkZ,
                cause: error,
              })))
            }
          }),
        ),
        Match.when({ type: 'UPDATE_MESH' }, ({ handle, meshData }) =>
          Effect.gen(function* (_) {
            try {
              const meshMap = yield* _(Ref.get(meshHandles))
              const mesh = meshMap.get(handle.id)

              if (!mesh) {
                yield* _(Effect.fail(new MeshError({
                  message: 'Mesh handle not found',
                  chunkX: handle.chunkX,
                  chunkZ: handle.chunkZ,
                })))
                return
              }

              // Dispose old geometry
              mesh.geometry.dispose()

              // Create new geometry
              const geometry = new THREE.BufferGeometry()
              geometry.setAttribute('position', new THREE.BufferAttribute(meshData.positions, 3))
              geometry.setAttribute('normal', new THREE.BufferAttribute(meshData.normals, 3))
              geometry.setAttribute('uv', new THREE.BufferAttribute(meshData.uvs, 2))
              geometry.setIndex(Array.from(meshData.indices))

              mesh.geometry = geometry
            } catch (error) {
              yield* _(Effect.fail(new MeshError({
                message: 'Failed to update mesh',
                chunkX: handle.chunkX,
                chunkZ: handle.chunkZ,
                cause: error,
              })))
            }
          }),
        ),
        Match.when({ type: 'REMOVE_MESH' }, ({ handle }) =>
          Effect.gen(function* (_) {
            try {
              const meshMap = yield* _(Ref.get(meshHandles))
              const mesh = meshMap.get(handle.id)

              if (mesh) {
                mesh.geometry.dispose()
                threeJsContext.scene.remove(mesh)
                yield* _(Ref.update(meshHandles, (map) => {
                  map.delete(handle.id)
                  return map
                }))
              }
            } catch (error) {
              yield* _(Effect.fail(new MeshError({
                message: 'Failed to remove mesh',
                chunkX: handle.chunkX,
                chunkZ: handle.chunkZ,
                cause: error,
              })))
            }
          }),
        ),
        Match.when({ type: 'ADD_CHUNK' }, ({ chunkX, chunkZ, positions, normals, uvs, indices }) =>
          Effect.gen(function* (_) {
            try {
              const geometry = new THREE.BufferGeometry()
              geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
              geometry.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
              geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
              geometry.setIndex(Array.from(indices))

              const wireframe = yield* _(Ref.get(isWireframe))
              const mesh = new THREE.Mesh(geometry, wireframe ? wireframeMaterial : chunkMaterial)
              mesh.position.set(chunkX * 16, 0, chunkZ * 16)

              threeJsContext.scene.add(mesh)
              yield* _(Ref.update(chunkMeshes, (map) => map.set(`${chunkX},${chunkZ}`, mesh)))
            } catch (error) {
              yield* _(Effect.fail(new MeshError({
                message: 'Failed to add chunk',
                chunkX,
                chunkZ,
                cause: error,
              })))
            }
          }),
        ),
        Match.when({ type: 'REMOVE_CHUNK' }, ({ chunkX, chunkZ }) =>
          Effect.gen(function* (_) {
            try {
              const key = `${chunkX},${chunkZ}`
              const meshMap = yield* _(Ref.get(chunkMeshes))
              const mesh = meshMap.get(key)

              if (mesh) {
                mesh.geometry.dispose()
                threeJsContext.scene.remove(mesh)
                yield* _(Ref.update(chunkMeshes, (map) => {
                  map.delete(key)
                  return map
                }))
              }
            } catch (error) {
              yield* _(Effect.fail(new MeshError({
                message: 'Failed to remove chunk',
                chunkX,
                chunkZ,
                cause: error,
              })))
            }
          }),
        ),
        Match.when({ type: 'UPDATE_CAMERA' }, ({ camera }) =>
          Effect.gen(function* (_) {
            try {
              threeJsContext.camera.position.set(camera.position.x, camera.position.y, camera.position.z)
              threeJsContext.camera.rotation.set(camera.rotation.x, camera.rotation.y, camera.rotation.z)
              
              if (camera.fov) threeJsContext.camera.fov = camera.fov
              if (camera.aspect) threeJsContext.camera.aspect = camera.aspect
              if (camera.near) threeJsContext.camera.near = camera.near
              if (camera.far) threeJsContext.camera.far = camera.far
              
              threeJsContext.camera.updateProjectionMatrix()
              yield* _(Ref.set(currentCamera, camera))
            } catch (error) {
              yield* _(Effect.fail(new CameraError({
                message: 'Failed to update camera',
                cause: error,
              })))
            }
          }),
        ),
        Match.when({ type: 'RESIZE' }, ({ config }) =>
          Effect.gen(function* (_) {
            try {
              threeJsContext.camera.aspect = config.width / config.height
              threeJsContext.camera.updateProjectionMatrix()
              threeJsContext.renderer.setSize(config.width, config.height)
              
              if (config.pixelRatio) {
                threeJsContext.renderer.setPixelRatio(config.pixelRatio)
              }
            } catch (error) {
              yield* _(Effect.fail(new RenderError({
                message: 'Failed to resize viewport',
                cause: error,
              })))
            }
          }),
        ),
        Match.when({ type: 'SET_FOG' }, ({ config }) =>
          Effect.gen(function* (_) {
            try {
              if (config.enabled && config.color) {
                const color = new THREE.Color(config.color.r, config.color.g, config.color.b)
                if (config.density !== undefined) {
                  threeJsContext.scene.fog = new THREE.FogExp2(color, config.density)
                } else {
                  threeJsContext.scene.fog = new THREE.Fog(color, config.near || 1, config.far || 1000)
                }
              } else {
                threeJsContext.scene.fog = null
              }
            } catch (error) {
              yield* _(Effect.fail(new RenderError({
                message: 'Failed to set fog',
                cause: error,
              })))
            }
          }),
        ),
        Match.when({ type: 'SET_LIGHTING' }, ({ config }) =>
          Effect.gen(function* (_) {
            try {
              // Remove existing lights (except basic ones we added)
              const lightsToRemove = threeJsContext.scene.children.filter(child => 
                child !== ambientLight && child !== directionalLight && child.type.includes('Light')
              )
              lightsToRemove.forEach(light => threeJsContext.scene.remove(light))

              // Update ambient light
              if (config.ambient) {
                ambientLight.color.setRGB(config.ambient.color.r, config.ambient.color.g, config.ambient.color.b)
                ambientLight.intensity = config.ambient.intensity
              }

              // Add directional lights
              if (config.directional) {
                config.directional.forEach(lightConfig => {
                  const light = new THREE.DirectionalLight()
                  light.color.setRGB(lightConfig.color.r, lightConfig.color.g, lightConfig.color.b)
                  light.intensity = lightConfig.intensity
                  light.position.set(lightConfig.direction.x, lightConfig.direction.y, lightConfig.direction.z)
                  threeJsContext.scene.add(light)
                })
              }
            } catch (error) {
              yield* _(Effect.fail(new RenderError({
                message: 'Failed to set lighting',
                cause: error,
              })))
            }
          }),
        ),
        Match.when({ type: 'SET_WIREFRAME' }, ({ enabled }) =>
          Effect.gen(function* (_) {
            try {
              yield* _(Ref.set(isWireframe, enabled))
              
              // Update existing meshes
              const meshMap = yield* _(Ref.get(chunkMeshes))
              const handleMap = yield* _(Ref.get(meshHandles))
              
              meshMap.forEach(mesh => {
                mesh.material = enabled ? wireframeMaterial : chunkMaterial
              })
              
              handleMap.forEach(mesh => {
                mesh.material = enabled ? wireframeMaterial : chunkMaterial
              })
            } catch (error) {
              yield* _(Effect.fail(new RenderError({
                message: 'Failed to set wireframe mode',
                cause: error,
              })))
            }
          }),
        ),
        Match.when({ type: 'RENDER_FRAME' }, () =>
          Effect.gen(function* (_) {
            try {
              threeJsContext.renderer.render(threeJsContext.scene, threeJsContext.camera)
            } catch (error) {
              yield* _(Effect.fail(new RenderError({
                message: 'Failed to render frame',
                cause: error,
              })))
            }
          }),
        ),
        Match.when({ type: 'CLEAR' }, () =>
          Effect.gen(function* (_) {
            try {
              threeJsContext.renderer.clear()
            } catch (error) {
              yield* _(Effect.fail(new RenderError({
                message: 'Failed to clear renderer',
                cause: error,
              })))
            }
          }),
        ),
        Match.exhaustive,
      )

    const processRenderQueue = () =>
      Queue.take(renderQueue).pipe(
        Effect.flatMap(processCommand),
        Effect.catchAll((error) => 
          Effect.gen(function* (_) {
            yield* _(Effect.logError('Error processing render command', error))
            return yield* _(Effect.fail(new RenderError({
              message: 'Render queue processing failed',
              cause: error,
            })))
          })
        ),
      )

    // Implementation of IRenderPort interface
    const render = () =>
      Queue.offer(renderQueue, { type: 'RENDER_FRAME' }).pipe(
        Effect.asVoid,
        Effect.mapError(error => new RenderError({
          message: 'Failed to queue render command',
          cause: error,
        }))
      )

    const clear = () =>
      Queue.offer(renderQueue, { type: 'CLEAR' }).pipe(
        Effect.asVoid,
        Effect.mapError(error => new RenderError({
          message: 'Failed to queue clear command',
          cause: error,
        }))
      )

    const resize = (config: ViewportConfig) =>
      Queue.offer(renderQueue, { type: 'RESIZE', config }).pipe(
        Effect.asVoid,
        Effect.mapError(error => new RenderError({
          message: 'Failed to queue resize command',
          cause: error,
        }))
      )

    const updateCamera = (camera: Camera) =>
      Queue.offer(renderQueue, { type: 'UPDATE_CAMERA', camera }).pipe(
        Effect.asVoid,
        Effect.mapError(error => new CameraError({
          message: 'Failed to queue camera update',
          cause: error,
        }))
      )

    const getCamera = () =>
      Ref.get(currentCamera).pipe(
        Effect.mapError(error => new CameraError({
          message: 'Failed to get camera',
          cause: error,
        }))
      )

    const createMesh = (meshData: ChunkMeshData) =>
      Effect.gen(function* (_) {
        const id = yield* _(generateMeshId())
        const handle: MeshHandle = { id, chunkX: meshData.chunkX, chunkZ: meshData.chunkZ }
        
        yield* _(
          Queue.offer(renderQueue, { type: 'CREATE_MESH', meshData }).pipe(
            Effect.asVoid,
            Effect.mapError(error => new MeshError({
              message: 'Failed to queue create mesh command',
              chunkX: meshData.chunkX,
              chunkZ: meshData.chunkZ,
              cause: error,
            }))
          )
        )
        
        return handle
      })

    const updateMesh = (handle: MeshHandle, meshData: ChunkMeshData) =>
      Queue.offer(renderQueue, { type: 'UPDATE_MESH', handle, meshData }).pipe(
        Effect.asVoid,
        Effect.mapError(error => new MeshError({
          message: 'Failed to queue update mesh command',
          chunkX: handle.chunkX,
          chunkZ: handle.chunkZ,
          cause: error,
        }))
      )

    const removeMesh = (handle: MeshHandle) =>
      Queue.offer(renderQueue, { type: 'REMOVE_MESH', handle }).pipe(
        Effect.asVoid,
        Effect.mapError(error => new MeshError({
          message: 'Failed to queue remove mesh command',
          chunkX: handle.chunkX,
          chunkZ: handle.chunkZ,
          cause: error,
        }))
      )

    // Backward compatibility methods
    const addChunkMesh = (meshData: ChunkMeshData) =>
      Queue.offer(renderQueue, {
        type: 'ADD_CHUNK',
        chunkX: meshData.chunkX,
        chunkZ: meshData.chunkZ,
        positions: meshData.positions,
        normals: meshData.normals,
        uvs: meshData.uvs,
        indices: meshData.indices,
      }).pipe(
        Effect.asVoid,
        Effect.mapError(error => new MeshError({
          message: 'Failed to queue add chunk mesh command',
          chunkX: meshData.chunkX,
          chunkZ: meshData.chunkZ,
          cause: error,
        }))
      )

    const removeChunkMesh = (chunkX: number, chunkZ: number) =>
      Queue.offer(renderQueue, { type: 'REMOVE_CHUNK', chunkX, chunkZ }).pipe(
        Effect.asVoid,
        Effect.mapError(error => new MeshError({
          message: 'Failed to queue remove chunk mesh command',
          chunkX,
          chunkZ,
          cause: error,
        }))
      )

    const updateChunkMesh = (meshData: ChunkMeshData) =>
      addChunkMesh(meshData) // For backward compatibility, just re-add

    const getStats = (): Effect.Effect<RenderStats, RenderError, never> =>
      Effect.gen(function* (_) {
        try {
          const meshMap = yield* _(Ref.get(chunkMeshes))
          const handleMap = yield* _(Ref.get(meshHandles))
          
          return {
            fps: 0, // Would need frame timing implementation
            frameTime: 0, // Would need frame timing implementation
            drawCalls: threeJsContext.renderer.info.render.calls,
            triangles: threeJsContext.renderer.info.render.triangles,
            memoryUsage: threeJsContext.renderer.info.memory.geometries + threeJsContext.renderer.info.memory.textures,
            activeMeshes: meshMap.size + handleMap.size,
          }
        } catch (error) {
          return yield* _(Effect.fail(new RenderError({
            message: 'Failed to get render stats',
            cause: error,
          })))
        }
      })

    const setWireframe = (enabled: boolean) =>
      Queue.offer(renderQueue, { type: 'SET_WIREFRAME', enabled }).pipe(
        Effect.asVoid,
        Effect.mapError(error => new RenderError({
          message: 'Failed to queue wireframe command',
          cause: error,
        }))
      )

    const setFog = (config: FogConfig) =>
      Queue.offer(renderQueue, { type: 'SET_FOG', config }).pipe(
        Effect.asVoid,
        Effect.mapError(error => new RenderError({
          message: 'Failed to queue fog command',
          cause: error,
        }))
      )

    const setLighting = (config: LightingConfig) =>
      Queue.offer(renderQueue, { type: 'SET_LIGHTING', config }).pipe(
        Effect.asVoid,
        Effect.mapError(error => new RenderError({
          message: 'Failed to queue lighting command',
          cause: error,
        }))
      )

    const dispose = () =>
      Effect.gen(function* (_) {
        try {
          // Clear all meshes
          const meshMap = yield* _(Ref.get(chunkMeshes))
          const handleMap = yield* _(Ref.get(meshHandles))
          
          meshMap.forEach(mesh => {
            mesh.geometry.dispose()
            threeJsContext.scene.remove(mesh)
          })
          
          handleMap.forEach(mesh => {
            mesh.geometry.dispose()
            threeJsContext.scene.remove(mesh)
          })
          
          // Dispose materials
          chunkMaterial.dispose()
          wireframeMaterial.dispose()
          
          // Dispose renderer
          threeJsContext.renderer.dispose()
        } catch (error) {
          return yield* _(Effect.fail(new ResourceError({
            message: 'Failed to dispose resources',
            resourceType: 'ThreeJsAdapter',
            cause: error,
          })))
        }
      })

    const getMemoryUsage = () =>
      Effect.gen(function* (_) {
        try {
          const info = threeJsContext.renderer.info
          return {
            totalBytes: (info.memory.geometries + info.memory.textures) * 1024, // Rough estimation
            textureBytes: info.memory.textures * 1024,
            geometryBytes: info.memory.geometries * 1024,
          }
        } catch (error) {
          return yield* _(Effect.fail(new ResourceError({
            message: 'Failed to get memory usage',
            resourceType: 'WebGLRenderer',
            cause: error,
          })))
        }
      })

    // Missing methods from IRenderPort interface
    const getMesh = (handle: MeshHandle) =>
      Effect.gen(function* (_) {
        try {
          const meshMap = yield* _(Ref.get(meshHandles))
          const mesh = meshMap.get(handle.id)
          
          if (!mesh) {
            return Option.none()
          }
          
          // Extract mesh data from Three.js mesh
          const geometry = mesh.geometry as THREE.BufferGeometry
          const positions = geometry.attributes.position?.array as Float32Array
          const normals = geometry.attributes.normal?.array as Float32Array
          const uvs = geometry.attributes.uv?.array as Float32Array
          const indices = geometry.index?.array as Uint32Array
          
          if (!positions || !normals || !uvs || !indices) {
            return Option.none()
          }
          
          const meshData: ChunkMeshData = {
            chunkX: handle.chunkX,
            chunkZ: handle.chunkZ,
            positions,
            normals,
            uvs,
            indices,
          }
          
          return Option.some(meshData)
        } catch (error) {
          return yield* _(Effect.fail(new MeshError({
            message: 'Failed to get mesh data',
            chunkX: handle.chunkX,
            chunkZ: handle.chunkZ,
            cause: error,
          })))
        }
      })

    const createMeshes = (meshes: ReadonlyArray<ChunkMeshData>) =>
      Effect.gen(function* (_) {
        const handles: MeshHandle[] = []
        
        for (const meshData of meshes) {
          const handle = yield* _(createMesh(meshData))
          handles.push(handle)
        }
        
        return handles
      })

    const updateMeshes = (updates: ReadonlyArray<{ handle: MeshHandle; meshData: ChunkMeshData }>) =>
      Effect.gen(function* (_) {
        for (const { handle, meshData } of updates) {
          yield* _(updateMesh(handle, meshData))
        }
      })

    const removeMeshes = (handles: ReadonlyArray<MeshHandle>) =>
      Effect.gen(function* (_) {
        for (const handle of handles) {
          yield* _(removeMesh(handle))
        }
      })

    const getStatsStream = () =>
      Effect.gen(function* (_) {
        // Create a stream that emits stats every frame
        return Effect.gen(function* (_) {
          return yield* _(getStats())
        })
      })

    const collectGarbage = () =>
      Effect.gen(function* (_) {
        try {
          const beforeMemory = yield* _(getMemoryUsage())
          
          // Force garbage collection in renderer
          threeJsContext.renderer.renderLists.dispose()
          
          const afterMemory = yield* _(getMemoryUsage())
          const freedBytes = beforeMemory.totalBytes - afterMemory.totalBytes
          
          return { freedBytes: Math.max(0, freedBytes) }
        } catch (error) {
          return yield* _(Effect.fail(new ResourceError({
            message: 'Failed to collect garbage',
            resourceType: 'WebGLRenderer',
            cause: error,
          })))
        }
      })

    const isReady = () =>
      Effect.gen(function* (_) {
        try {
          // Check if renderer and context are ready
          return threeJsContext.renderer && 
                 threeJsContext.scene && 
                 threeJsContext.camera &&
                 threeJsContext.canvas.isConnected
        } catch (error) {
          return yield* _(Effect.fail(new RenderError({
            message: 'Failed to check render readiness',
            cause: error,
          })))
        }
      })

    const waitForReady = () =>
      Effect.gen(function* (_) {
        const ready = yield* _(isReady())
        if (!ready) {
          return yield* _(Effect.fail(new RenderError({
            message: 'Renderer is not ready',
          })))
        }
      })

    // Start processing render queue in background
    yield* _(processRenderQueue().pipe(Effect.forever, Effect.forkScoped))

    return ThreeJsAdapter.of({
      renderQueue,
      processRenderQueue,
      render,
      clear,
      resize,
      updateCamera,
      getCamera,
      createMesh,
      updateMesh,
      removeMesh,
      getMesh,
      createMeshes,
      updateMeshes,
      removeMeshes,
      addChunkMesh,
      removeChunkMesh,
      updateChunkMesh,
      getStats,
      getStatsStream,
      setWireframe,
      setFog,
      setLighting,
      dispose,
      getMemoryUsage,
      collectGarbage,
      isReady,
      waitForReady,
    })
  }),
)

/**
 * Three.js Context Layer - provides Three.js context
 */
export const ThreeJsContextLive = Layer.sync(ThreeJsContext, () => {
  const canvas = document.createElement('canvas')
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
  })

  renderer.setSize(window.innerWidth, window.innerHeight)
  renderer.setClearColor(0x87ceeb) // Sky blue
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene()
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000)

  // Add canvas to DOM
  document.body.appendChild(canvas)

  return {
    scene,
    camera,
    renderer,
    canvas,
  }
})
