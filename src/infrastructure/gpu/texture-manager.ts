import { Effect, Layer, Ref, Option } from 'effect'

import * as THREE from 'three'
import { ObjectPool } from '/performance/object-pool'

// --- Configuration ---

const CONFIG = {
  ATLAS_SIZE: 2048, // 2K texture atlas
  TILE_SIZE: 16, // Individual texture size
  MAX_MIPMAPS: 4,
  ANISOTROPY: 16,
  COMPRESSION_ENABLED: true,
  LAZY_LOADING: true,
  PRELOAD_ESSENTIALS: true,
  CACHE_SIZE: 256,
  STREAMING_ENABLED: true,
} as const

// --- Texture Manager Types ---

/**
 * Texture atlas coordinates
 */
export interface TextureAtlasCoords {
  u: number // Normalized U coordinate (0-1)
  v: number // Normalized V coordinate (0-1)
  w: number // Normalized width (0-1)
  h: number // Normalized height (0-1)
  atlasIndex: number // Which atlas this texture is in
}

/**
 * Texture metadata
 */
export interface TextureMetadata {
  name: string
  path: string
  size: { width: number; height: number }
  format: string
  hasAlpha: boolean
  isAnimated: boolean
  frameCount?: number
  frameRate?: number
  atlasCoords?: TextureAtlasCoords
  lastAccessed: number
  loadPriority: number
}

/**
 * Texture atlas data
 */
export interface TextureAtlas {
  texture: THREE.Texture
  canvas: OffscreenCanvas | HTMLCanvasElement
  context: OffscreenCanvasRenderingContext2D | CanvasRenderingContext2D
  allocatedRegions: Map<string, TextureAtlasCoords>
  freeRegions: Array<{ x: number; y: number; width: number; height: number }>
  atlasIndex: number
  usage: number // Percentage of atlas used
}

/**
 * Streaming texture data
 */
export interface StreamingTexture {
  lowRes: THREE.Texture // Low resolution version loaded immediately
  highRes?: THREE.Texture // High resolution version loaded on demand
  isLoading: boolean
  loadPromise?: Promise<THREE.Texture>
}

/**
 * Animated texture frame
 */
export interface AnimatedTextureFrame {
  texture: THREE.Texture
  duration: number // Frame duration in milliseconds
}

/**
 * Animated texture data
 */
export interface AnimatedTexture {
  frames: AnimatedTextureFrame[]
  currentFrame: number
  lastFrameTime: number
  totalDuration: number
  isLooping: boolean
}

/**
 * Texture manager state
 */
export interface TextureManagerState {
  atlases: Map<number, TextureAtlas>
  textures: Map<string, TextureMetadata>
  streamingTextures: Map<string, StreamingTexture>
  animatedTextures: Map<string, AnimatedTexture>
  loadQueue: Array<{ name: string; priority: number }>
  cache: Map<string, THREE.Texture>
  stats: {
    totalTextures: number
    loadedTextures: number
    atlasUsage: number
    memoryUsage: number
    cacheHits: number
    cacheMisses: number
  }
}

// --- Block Texture Definitions ---

const BLOCK_TEXTURES = {
  // Basic blocks
  stone: {
    path: '/textures/blocks/stone.png',
    priority: 10,
    faces: { all: 'stone' },
  },
  dirt: {
    path: '/textures/blocks/dirt.png',
    priority: 10,
    faces: { all: 'dirt' },
  },
  grass: {
    path: '/textures/blocks/grass_top.png',
    priority: 10,
    faces: {
      top: 'grass_top',
      bottom: 'dirt',
      sides: 'grass_side',
    },
  },
  wood: {
    path: '/textures/blocks/wood_oak.png',
    priority: 8,
    faces: {
      top: 'wood_oak_top',
      bottom: 'wood_oak_top',
      sides: 'wood_oak',
    },
  },
  sand: {
    path: '/textures/blocks/sand.png',
    priority: 7,
    faces: { all: 'sand' },
  },
  cobblestone: {
    path: '/textures/blocks/cobblestone.png',
    priority: 6,
    faces: { all: 'cobblestone' },
  },
  // Liquids
  water: {
    path: '/textures/blocks/water_still.png',
    priority: 9,
    faces: { all: 'water' },
    animated: true,
    frameCount: 32,
    frameRate: 2,
  },
  lava: {
    path: '/textures/blocks/lava_still.png',
    priority: 5,
    faces: { all: 'lava' },
    animated: true,
    frameCount: 20,
    frameRate: 3,
  },
  // Special blocks
  glass: {
    path: '/textures/blocks/glass.png',
    priority: 4,
    faces: { all: 'glass' },
    hasAlpha: true,
  },
} as const

// --- Memory Pools ---

const texturePool = new ObjectPool<THREE.Texture>(
  () => new THREE.Texture(),
  (texture: THREE.Texture) => {
    texture.dispose()
    return new THREE.Texture()
  },
  CONFIG.CACHE_SIZE,
)

const canvasPool = new ObjectPool<HTMLCanvasElement>(
  () => document.createElement('canvas'),
  (canvas: HTMLCanvasElement) => {
    const ctx = canvas.getContext('2d')
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height)
    }
    return canvas
  },
  16,
)

// --- Utility Functions ---

/**
 * Create optimal texture settings
 */
const applyTextureSettings = (texture: THREE.Texture, metadata: TextureMetadata): THREE.Texture => {
  // Filtering
  texture.magFilter = THREE.NearestFilter // Pixel art style
  texture.minFilter = CONFIG.MAX_MIPMAPS > 1 ? THREE.NearestMipmapLinearFilter : THREE.NearestFilter

  // Wrapping
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping

  // Anisotropy for better quality at angles
  texture.anisotropy = CONFIG.ANISOTROPY

  // Generate mipmaps if needed
  if (CONFIG.MAX_MIPMAPS > 1) {
    texture.generateMipmaps = true
  }

  // Format optimization
  if (!metadata.hasAlpha) {
    texture.format = THREE.RGBFormat
  }

  return texture
}

/**
 * Find best fit region in atlas
 */
const findAtlasRegion = (atlas: TextureAtlas, width: number, height: number): { x: number; y: number } | null => {
  // Simple first-fit algorithm - could be improved with better bin packing
  for (let i = 0; i < atlas.freeRegions.length; i++) {
    const region = atlas.freeRegions[i]
    if (region.width >= width && region.height >= height) {
      // Found a suitable region
      const result = { x: region.x, y: region.y }

      // Update free regions
      const remainingWidth = region.width - width
      const remainingHeight = region.height - height

      // Remove the used region
      atlas.freeRegions.splice(i, 1)

      // Add remaining regions back
      if (remainingWidth > 0) {
        atlas.freeRegions.push({
          x: region.x + width,
          y: region.y,
          width: remainingWidth,
          height: height,
        })
      }

      if (remainingHeight > 0) {
        atlas.freeRegions.push({
          x: region.x,
          y: region.y + height,
          width: region.width,
          height: remainingHeight,
        })
      }

      return result
    }
  }

  return null
}

/**
 * Create new texture atlas
 */
const createTextureAtlas = (atlasIndex: number): TextureAtlas => {
  const canvas = document.createElement('canvas')
  canvas.width = CONFIG.ATLAS_SIZE
  canvas.height = CONFIG.ATLAS_SIZE

  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Failed to create 2D context for texture atlas')
  }

  // Clear canvas with transparent background
  context.fillStyle = 'rgba(0, 0, 0, 0)'
  context.fillRect(0, 0, CONFIG.ATLAS_SIZE, CONFIG.ATLAS_SIZE)

  const texture = new THREE.Texture(canvas)
  texture.flipY = false
  texture.needsUpdate = true

  return {
    texture,
    canvas,
    context,
    allocatedRegions: new Map(),
    freeRegions: [
      {
        x: 0,
        y: 0,
        width: CONFIG.ATLAS_SIZE,
        height: CONFIG.ATLAS_SIZE,
      },
    ],
    atlasIndex,
    usage: 0,
  }
}

/**
 * Load image data
 */
const loadImageData = (path: string): Effect.Effect<ImageData, never, never> =>
  Effect.async<ImageData>((resume) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      const canvas = canvasPool.acquire()
      canvas.width = img.width
      canvas.height = img.height

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        canvasPool.release(canvas)
        return resume(Effect.fail(new Error('Failed to create 2D context')))
      }

      ctx.drawImage(img, 0, 0)
      const imageData = ctx.getImageData(0, 0, img.width, img.height)

      canvasPool.release(canvas)
      resume(Effect.succeed(imageData))
    }

    img.onerror = () => {
      resume(Effect.fail(new Error(`Failed to load texture: ${path}`)))
    }

    img.src = path
  })

/**
 * Add texture to atlas
 */
const addTextureToAtlas = (atlas: TextureAtlas, name: string, imageData: ImageData): TextureAtlasCoords | null => {
  const region = findAtlasRegion(atlas, imageData.width, imageData.height)
  if (!region) {
    return null // Atlas is full
  }

  // Draw image to atlas
  atlas.context.putImageData(imageData, region.x, region.y)
  atlas.texture.needsUpdate = true

  // Calculate normalized coordinates
  const coords: TextureAtlasCoords = {
    u: region.x / CONFIG.ATLAS_SIZE,
    v: region.y / CONFIG.ATLAS_SIZE,
    w: imageData.width / CONFIG.ATLAS_SIZE,
    h: imageData.height / CONFIG.ATLAS_SIZE,
    atlasIndex: atlas.atlasIndex,
  }

  atlas.allocatedRegions.set(name, coords)
  atlas.usage =
    ((CONFIG.ATLAS_SIZE * CONFIG.ATLAS_SIZE - atlas.freeRegions.reduce((sum, region) => sum + region.width * region.height, 0)) / (CONFIG.ATLAS_SIZE * CONFIG.ATLAS_SIZE)) * 100

  return coords
}

/**
 * Create procedural texture (fallback)
 */
const createProceduralTexture = (name: string, color: THREE.Color): THREE.Texture => {
  const canvas = document.createElement('canvas')
  canvas.width = CONFIG.TILE_SIZE
  canvas.height = CONFIG.TILE_SIZE

  const ctx = canvas.getContext('2d')
  if (ctx) {
    ctx.fillStyle = `rgb(${Math.floor(color.r * 255)}, ${Math.floor(color.g * 255)}, ${Math.floor(color.b * 255)})`
    ctx.fillRect(0, 0, CONFIG.TILE_SIZE, CONFIG.TILE_SIZE)

    // Add some noise for basic texture
    for (let i = 0; i < 100; i++) {
      const x = Math.random() * CONFIG.TILE_SIZE
      const y = Math.random() * CONFIG.TILE_SIZE
      const brightness = Math.random() * 0.3 - 0.15
      ctx.fillStyle = `rgb(${Math.floor((color.r + brightness) * 255)}, ${Math.floor((color.g + brightness) * 255)}, ${Math.floor((color.b + brightness) * 255)})`
      ctx.fillRect(x, y, 1, 1)
    }
  }

  const texture = new THREE.Texture(canvas)
  texture.needsUpdate = true
  return applyTextureSettings(texture, {
    name,
    path: '',
    size: { width: CONFIG.TILE_SIZE, height: CONFIG.TILE_SIZE },
    format: 'RGB',
    hasAlpha: false,
    isAnimated: false,
    lastAccessed: Date.now(),
    loadPriority: 0,
  })
}

// --- Pure State Functions ---

const initializeTextures = (state: TextureManagerState): TextureManagerState => {
  const loadQueue: Array<{ name: string; priority: number }> = []

  // Add all block textures to load queue
  Object.entries(BLOCK_TEXTURES).forEach(([name, config]) => {
    loadQueue.push({ name, priority: config.priority })
  })

  // Sort by priority (higher priority first)
  loadQueue.sort((a, b) => b.priority - a.priority)

  return {
    ...state,
    loadQueue,
  }
}

const _addTextureMetadata = (state: TextureManagerState, name: string, metadata: TextureMetadata): TextureManagerState => {
  const newTextures = new Map(state.textures)
  newTextures.set(name, metadata)

  return {
    ...state,
    textures: newTextures,
    stats: {
      ...state.stats,
      totalTextures: newTextures.size,
    },
  }
}

// --- Main Service ---

export interface TextureManagerService {
  loadTexture: (name: string) => Effect.Effect<THREE.Texture, never, never>
  getTexture: (name: string) => Effect.Effect<Option.Option<THREE.Texture>, never, never>
  getAtlasCoords: (name: string) => Effect.Effect<Option.Option<TextureAtlasCoords>, never, never>
  preloadEssentials: () => Effect.Effect<void, never, never>
  createAnimatedTexture: (name: string, frames: string[], frameRate: number) => Effect.Effect<AnimatedTexture, never, never>
  updateAnimations: (deltaTime: number) => Effect.Effect<void, never, never>
  getTextureAtlas: (atlasIndex: number) => Effect.Effect<Option.Option<THREE.Texture>, never, never>
  optimizeAtlases: () => Effect.Effect<void, never, never>
  getStats: () => Effect.Effect<TextureManagerState['stats'], never, never>
  dispose: () => Effect.Effect<void, never, never>
}

export const TextureManagerService = Effect.Tag<TextureManagerService>('TextureManagerService')

export const TextureManagerLive = Layer.effect(
  TextureManagerService,
  Effect.gen(function* (_) {
    const initialState: TextureManagerState = {
      atlases: new Map(),
      textures: new Map(),
      streamingTextures: new Map(),
      animatedTextures: new Map(),
      loadQueue: [],
      cache: new Map(),
      stats: {
        totalTextures: 0,
        loadedTextures: 0,
        atlasUsage: 0,
        memoryUsage: 0,
        cacheHits: 0,
        cacheMisses: 0,
      },
    }

    const stateRef = yield* _(Ref.make(initializeTextures(initialState)))

    // Create initial atlas
    const initialAtlas = createTextureAtlas(0)
    yield* _(
      Ref.update(stateRef, (state) => ({
        ...state,
        atlases: new Map([[0, initialAtlas]]),
      })),
    )

    return {
      loadTexture: (name: string) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))

          // Check cache first
          const cached = state.cache.get(name)
          if (cached) {
            yield* _(
              Ref.update(stateRef, (s) => ({
                ...s,
                stats: { ...s.stats, cacheHits: s.stats.cacheHits + 1 },
              })),
            )
            return cached
          }

          // Check if texture config exists
          const textureConfig = BLOCK_TEXTURES[name as keyof typeof BLOCK_TEXTURES]
          if (!textureConfig) {
            // Create procedural texture as fallback
            const fallbackColors = {
              stone: new THREE.Color(0x777777),
              dirt: new THREE.Color(0x8b4513),
              grass: new THREE.Color(0x228b22),
              wood: new THREE.Color(0xd2b48c),
              sand: new THREE.Color(0xf4a460),
              water: new THREE.Color(0x4682b4),
              lava: new THREE.Color(0xff4500),
            }
            const color = fallbackColors[name as keyof typeof fallbackColors] || new THREE.Color(0x888888)
            return createProceduralTexture(name, color)
          }

          // Load image data
          const imageData = yield* _(loadImageData(textureConfig.path).pipe(Effect.catchAll(() => Effect.succeed(new ImageData(CONFIG.TILE_SIZE, CONFIG.TILE_SIZE)))))

          // Try to add to existing atlas
          let atlas = state.atlases.get(0)
          let coords: TextureAtlasCoords | null = null

          if (atlas) {
            coords = addTextureToAtlas(atlas, name, imageData)
          }

          // If couldn't fit, create new atlas
          if (!coords) {
            const newAtlasIndex = state.atlases.size
            const newAtlas = createTextureAtlas(newAtlasIndex)
            coords = addTextureToAtlas(newAtlas, name, imageData)

            if (coords) {
              yield* _(
                Ref.update(stateRef, (s) => ({
                  ...s,
                  atlases: new Map([...s.atlases, [newAtlasIndex, newAtlas]]),
                })),
              )
            }
          }

          // Create individual texture if needed
          let texture: THREE.Texture
          if (coords && atlas) {
            texture = atlas.texture.clone()
            texture.needsUpdate = true
          } else {
            // Create standalone texture
            const canvas = document.createElement('canvas')
            canvas.width = imageData.width
            canvas.height = imageData.height
            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.putImageData(imageData, 0, 0)
            }

            texture = new THREE.Texture(canvas)
            texture.needsUpdate = true
          }

          // Apply texture settings
          const metadata: TextureMetadata = {
            name,
            path: textureConfig.path,
            size: { width: imageData.width, height: imageData.height },
            format: textureConfig.hasAlpha ? 'RGBA' : 'RGB',
            hasAlpha: textureConfig.hasAlpha || false,
            isAnimated: textureConfig.animated || false,
            frameCount: textureConfig.frameCount,
            frameRate: textureConfig.frameRate,
            atlasCoords: coords,
            lastAccessed: Date.now(),
            loadPriority: textureConfig.priority,
          }

          texture = applyTextureSettings(texture, metadata)

          // Update state
          yield* _(
            Ref.update(stateRef, (s) => ({
              ...s,
              textures: new Map([...s.textures, [name, metadata]]),
              cache: new Map([...s.cache, [name, texture]]),
              stats: {
                ...s.stats,
                loadedTextures: s.stats.loadedTextures + 1,
                cacheMisses: s.stats.cacheMisses + 1,
              },
            })),
          )

          return texture
        }),

      getTexture: (name: string) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          const texture = state.cache.get(name)
          return Option.fromNullable(texture)
        }),

      getAtlasCoords: (name: string) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          const metadata = state.textures.get(name)
          return Option.fromNullable(metadata?.atlasCoords)
        }),

      preloadEssentials: () =>
        Effect.gen(function* () {
          if (!CONFIG.PRELOAD_ESSENTIALS) return

          const essentials = ['stone', 'dirt', 'grass', 'water', 'sand']
          for (const name of essentials) {
            yield* _(
              Effect.gen(function* () {
                const state = yield* _(Ref.get(stateRef))
                if (!state.cache.has(name)) {
                  // Load texture implementation would go here
                  // For now, create a simple fallback
                  const fallbackColor = new THREE.Color(0x888888)
                  const texture = createProceduralTexture(name, fallbackColor)
                  yield* _(
                    Ref.update(stateRef, (s) => ({
                      ...s,
                      cache: new Map([...s.cache, [name, texture]]),
                    })),
                  )
                }
              }),
            )
          }
        }),

      createAnimatedTexture: (name: string, frames: string[], frameRate: number) =>
        Effect.gen(function* () {
          const frameTextures: THREE.Texture[] = []
          for (const frameName of frames) {
            const state = yield* _(Ref.get(stateRef))
            let texture = state.cache.get(frameName)
            if (!texture) {
              // Create fallback texture
              texture = createProceduralTexture(frameName, new THREE.Color(0x888888))
              yield* _(
                Ref.update(stateRef, (s) => ({
                  ...s,
                  cache: new Map([...s.cache, [frameName, texture]]),
                })),
              )
            }
            frameTextures.push(texture)
          }

          const animatedTexture: AnimatedTexture = {
            frames: frameTextures.map((texture: THREE.Texture) => ({
              texture,
              duration: 1000 / frameRate, // Convert to milliseconds
            })),
            currentFrame: 0,
            lastFrameTime: Date.now(),
            totalDuration: frames.length * (1000 / frameRate),
            isLooping: true,
          }

          yield* _(
            Ref.update(stateRef, (state) => ({
              ...state,
              animatedTextures: new Map([...state.animatedTextures, [name, animatedTexture]]),
            })),
          )

          return animatedTexture
        }),

      updateAnimations: (_deltaTime: number) =>
        Effect.gen(function* () {
          yield* _(
            Ref.update(stateRef, (state) => {
              const newAnimatedTextures = new Map(state.animatedTextures)

              for (const [name, animation] of newAnimatedTextures) {
                const currentTime = Date.now()
                const elapsed = currentTime - animation.lastFrameTime

                if (elapsed >= animation.frames[animation.currentFrame].duration) {
                  const nextFrame = (animation.currentFrame + 1) % animation.frames.length
                  newAnimatedTextures.set(name, {
                    ...animation,
                    currentFrame: nextFrame,
                    lastFrameTime: currentTime,
                  })
                }
              }

              return {
                ...state,
                animatedTextures: newAnimatedTextures,
              }
            }),
          )
        }),

      getTextureAtlas: (atlasIndex: number) =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))
          const atlas = state.atlases.get(atlasIndex)
          return Option.fromNullable(atlas?.texture)
        }),

      optimizeAtlases: () =>
        Effect.gen(function* () {
          // Clean up unused textures from cache
          yield* _(
            Ref.update(stateRef, (state) => {
              const currentTime = Date.now()
              const CACHE_TIMEOUT = 300000 // 5 minutes

              const newCache = new Map<string, THREE.Texture>()
              const newTextures = new Map<string, TextureMetadata>()

              for (const [name, metadata] of state.textures) {
                if (currentTime - metadata.lastAccessed < CACHE_TIMEOUT) {
                  newTextures.set(name, metadata)
                  const texture = state.cache.get(name)
                  if (texture) {
                    newCache.set(name, texture)
                  }
                } else {
                  // Dispose old texture
                  const texture = state.cache.get(name)
                  if (texture) {
                    texture.dispose()
                  }
                }
              }

              return {
                ...state,
                cache: newCache,
                textures: newTextures,
                stats: {
                  ...state.stats,
                  loadedTextures: newCache.size,
                },
              }
            }),
          )
        }),

      getStats: () =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))

          // Calculate memory usage
          let memoryUsage = 0
          for (const _atlas of state.atlases.values()) {
            memoryUsage += CONFIG.ATLAS_SIZE * CONFIG.ATLAS_SIZE * 4 // RGBA
          }

          const totalAtlasUsage = Array.from(state.atlases.values()).reduce((sum, atlas) => sum + atlas.usage, 0) / state.atlases.size

          return {
            ...state.stats,
            atlasUsage: totalAtlasUsage,
            memoryUsage,
          }
        }),

      dispose: () =>
        Effect.gen(function* () {
          const state = yield* _(Ref.get(stateRef))

          // Dispose all textures
          for (const texture of state.cache.values()) {
            texture.dispose()
          }

          // Dispose atlas textures
          for (const atlas of state.atlases.values()) {
            atlas.texture.dispose()
          }

          // Clear pools
          texturePool.clear()
          canvasPool.clear()

          yield* _(Ref.set(stateRef, initialState))
        }),
    }
  }),
)

// Export types and configuration
export type { TextureManagerState, TextureAtlas, TextureMetadata, TextureAtlasCoords, StreamingTexture, AnimatedTexture }
export { CONFIG as TextureManagerConfig, BLOCK_TEXTURES }
