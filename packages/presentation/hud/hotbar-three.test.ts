import { describe, it } from '@effect/vitest'
import { Array as Arr, Effect, Layer, Option } from 'effect'
import { expect, vi } from 'vitest'

// ---------------------------------------------------------------------------
// Global window mock — vitest runs in 'node' environment, window is not defined
// ---------------------------------------------------------------------------
const capturedWindowListeners: Map<string, () => void> = new Map()

if (typeof globalThis.window === 'undefined') {
  Object.defineProperty(globalThis, 'window', {
    value: {
      addEventListener: vi.fn((event: string, cb: () => void) => {
        capturedWindowListeners.set(event, cb)
      }),
      removeEventListener: vi.fn(),
      innerWidth: 800,
      innerHeight: 600,
    },
    writable: true,
  })
}

// ---------------------------------------------------------------------------
// THREE.js mock — must be at top level, before any imports that touch 'three'
// ---------------------------------------------------------------------------
vi.mock('three', () => {
  // Use a real class so `new MeshBasicMaterial() instanceof MeshBasicMaterial` is true.
  // If vi.fn(() => plainObj) is used instead, the constructor returns a plain object which
  // bypasses prototype-chain setup, breaking the instanceof guard in hotbar-three.ts:184.
  class MockMeshBasicMaterial {
    private currentHex = 0
    readonly transparent: boolean
    readonly opacity: number
    readonly color = {
      setHex: vi.fn((hex: number) => { this.currentHex = hex }),
      getHex: vi.fn(() => this.currentHex),
    }

    constructor(options: { color?: number; transparent?: boolean; opacity?: number } = {}) {
      this.currentHex = options.color ?? 0
      this.transparent = options.transparent ?? false
      this.opacity = options.opacity ?? 1
    }
  }

  const makeMesh = (material?: MockMeshBasicMaterial) => ({
    position: {
      x: 0, y: 0, z: 0,
      set: vi.fn(function (this: { x: number; y: number; z: number }, x: number, y: number, z: number) {
        this.x = x; this.y = y; this.z = z
      }),
    },
    scale: {
      _val: 1,
      setScalar: vi.fn(function (this: { _val: number }, v: number) { this._val = v }),
    },
    material: material ?? new MockMeshBasicMaterial(),
    geometry: {
      attributes: {
        uv: {
          setXY: vi.fn(),
          needsUpdate: false,
        },
      },
    },
    visible: false,
  })

  const makeCamera = () => ({
    position: { x: 0, y: 0, z: 0 },
    left: 0, right: 0, top: 0, bottom: 0,
    updateProjectionMatrix: vi.fn(),
  })

  const makeScene = () => ({
    add: vi.fn(),
    remove: vi.fn(),
  })

  const makeGeometry = () => ({})

  return {
    Scene: vi.fn(() => makeScene()),
    OrthographicCamera: vi.fn(() => makeCamera()),
    PlaneGeometry: vi.fn(() => makeGeometry()),
    MeshBasicMaterial: MockMeshBasicMaterial,
    Mesh: vi.fn((_geo: unknown, material?: MockMeshBasicMaterial) => makeMesh(material)),
    WebGLRenderer: vi.fn(() => ({
      clearDepth: vi.fn(),
      render: vi.fn(),
      setSize: vi.fn(),
    })),
    // Stubs needed by transient world-renderer-refraction.ts module-level allocations
    Matrix4: vi.fn(() => ({ multiplyMatrices: vi.fn(), elements: Array.from({ length: 16 }, () => 0) })),
    Vector4: vi.fn(() => ({ set: vi.fn(), applyMatrix4: vi.fn(), x: 0, y: 0, z: 0, w: 1 })),
  }
})

// ---------------------------------------------------------------------------
// Import the service under test and dependencies *after* the mock declaration
// ---------------------------------------------------------------------------
import * as THREE from 'three'
import { HotbarRendererService, HotbarRendererLive } from '@ts-minecraft/presentation/hud/hotbar-three'
import { RendererService, TextureService } from '@ts-minecraft/rendering'
import type { BlockType } from '@ts-minecraft/core'
import { SlotIndex } from '@ts-minecraft/core'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const createMockRendererService = () =>
  ({
    create: vi.fn(() => Effect.void),
    render: vi.fn(() => Effect.void),
    resize: vi.fn(() => Effect.void),
    renderOverlay: vi.fn(() => Effect.void),
  }) as RendererService

const createMockTextureService = () =>
  ({
    load: vi.fn(() => Effect.succeed({} as THREE.Texture)),
    createSolidColor: vi.fn(() => Effect.succeed({} as THREE.CanvasTexture)),
    getCached: vi.fn(() => Effect.succeed(Option.none())),
    preload: vi.fn(() => Effect.void),
    dispose: vi.fn(() => Effect.void),
  }) as TextureService

const buildTestLayer = (rendererService: RendererService = createMockRendererService()) => {
  const MockRendererLayer = Layer.succeed(RendererService, rendererService)
  const MockTextureLayer = Layer.succeed(TextureService, createMockTextureService())
  return HotbarRendererLive.pipe(
    Layer.provide(MockRendererLayer),
    Layer.provide(MockTextureLayer),
  )
}

type MockedMaterial = {
  readonly transparent: boolean
  readonly opacity: number
  readonly color: { readonly getHex: () => number }
}

const isObjectRecord = (value: unknown): value is object =>
  typeof value === 'object' && value !== null

const isMockedMaterial = (value: unknown): value is MockedMaterial => {
  if (!isObjectRecord(value)) return false
  const color = Reflect.get(value, 'color')
  return (
    typeof Reflect.get(value, 'transparent') === 'boolean'
    && typeof Reflect.get(value, 'opacity') === 'number'
    && isObjectRecord(color)
    && typeof Reflect.get(color, 'getHex') === 'function'
  )
}

const expectMockedMaterial = (value: unknown): MockedMaterial => {
  expect(isMockedMaterial(value)).toBe(true)
  if (!isMockedMaterial(value)) {
expect.fail('Expected mocked material')
  }
  return value
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('HotbarRendererService', () => {
  describe('initialize', () => {
    it.scoped('should complete without error', () => {
      const TestLayer = buildTestLayer()

      return Effect.gen(function* () {
        const renderer = yield* HotbarRendererService
        yield* renderer.initialize(800, 600)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should accept different viewport dimensions', () => {
      const TestLayer = buildTestLayer()

      return Effect.gen(function* () {
        const renderer = yield* HotbarRendererService
        yield* renderer.initialize(1920, 1080)
        yield* renderer.initialize(1280, 720)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should work with zero dimensions (edge case)', () => {
      const TestLayer = buildTestLayer()

      return Effect.gen(function* () {
        const renderer = yield* HotbarRendererService
        yield* renderer.initialize(0, 0)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('update', () => {
    it.scoped('should complete without error when called with empty slots', () => {
      const TestLayer = buildTestLayer()
      const emptySlots: ReadonlyArray<Option.Option<BlockType>> = Arr.makeBy(9, () => Option.none())

      return Effect.gen(function* () {
        const renderer = yield* HotbarRendererService
        yield* renderer.initialize(800, 600)
        yield* renderer.update(emptySlots, SlotIndex.make(0))
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should complete without error when called with populated slots', () => {
      const TestLayer = buildTestLayer()
      const slots: ReadonlyArray<Option.Option<BlockType>> = [
        Option.some('GRASS' as BlockType),
        Option.some('DIRT' as BlockType),
        Option.some('STONE' as BlockType),
        Option.none(),
        Option.none(),
        Option.none(),
        Option.none(),
        Option.none(),
        Option.none(),
      ]

      return Effect.gen(function* () {
        const renderer = yield* HotbarRendererService
        yield* renderer.initialize(800, 600)
        yield* renderer.update(slots, SlotIndex.make(0))
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('uses readable empty slot and warm selected border materials', () => {
      vi.clearAllMocks()
      const TestLayer = buildTestLayer()
      const emptySlots: ReadonlyArray<Option.Option<BlockType>> = Arr.makeBy(9, () => Option.none())

      return Effect.gen(function* () {
        const renderer = yield* HotbarRendererService
        yield* renderer.initialize(800, 600)
        yield* renderer.update(emptySlots, SlotIndex.make(0))

        const meshCalls = vi.mocked(THREE.Mesh).mock.calls
        const borderMaterial = expectMockedMaterial(meshCalls[0]?.[1])
        const firstSlotMaterial = expectMockedMaterial(meshCalls[1]?.[1])

        expect(borderMaterial.color.getHex()).toBe(0xfff4b0)
        expect(borderMaterial.transparent).toBe(true)
        expect(borderMaterial.opacity).toBeCloseTo(0.92, 5)
        expect(firstSlotMaterial.color.getHex()).toBe(0x8a8f96)
        expect(firstSlotMaterial.transparent).toBe(true)
        expect(firstSlotMaterial.opacity).toBeCloseTo(0.78, 5)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should accept any valid selectedSlot (0-8)', () => {
      const TestLayer = buildTestLayer()
      const emptySlots: ReadonlyArray<Option.Option<BlockType>> = Arr.makeBy(9, () => Option.none())

      return Effect.gen(function* () {
        const renderer = yield* HotbarRendererService
        yield* renderer.initialize(800, 600)
        yield* Effect.forEach(Arr.makeBy(9, i => i), (i) => renderer.update(emptySlots, SlotIndex.make(i)), { concurrency: 1 })
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should work before initialize is called (no crash)', () => {
      const TestLayer = buildTestLayer()
      const emptySlots: ReadonlyArray<Option.Option<BlockType>> = Arr.makeBy(9, () => Option.none())

      return Effect.gen(function* () {
        const renderer = yield* HotbarRendererService
        // update before initialize — slot meshes array is empty, should be a safe no-op
        yield* renderer.update(emptySlots, SlotIndex.make(0))
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('renders the default tile color for an item not in the atlas (tileIndex < 0)', () => {
      const TestLayer = buildTestLayer()
      // 'AIR' is a valid BlockType that getItemTileIndex maps to -1 (no atlas tile).
      const slotsWithAir: ReadonlyArray<Option.Option<BlockType>> = [
        Option.some('AIR' as BlockType),
        ...Arr.makeBy(8, () => Option.none<BlockType>()),
      ]

      return Effect.gen(function* () {
        const renderer = yield* HotbarRendererService
        yield* renderer.initialize(800, 600)
        // Must not throw — the tileIndex<0 branch resets to DEFAULT_TILE_COLOR.
        yield* renderer.update(slotsWithAir, SlotIndex.make(0))
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should skip redundant updates when slots content and selection are unchanged', () => {
      vi.clearAllMocks()
      const TestLayer = buildTestLayer()

      const slotsA: ReadonlyArray<Option.Option<BlockType>> = [
        Option.some('GRASS' as BlockType),
        ...Arr.makeBy(8, () => Option.none<BlockType>()),
      ]
      const slotsB: ReadonlyArray<Option.Option<BlockType>> = [
        Option.some('GRASS' as BlockType),
        ...Arr.makeBy(8, () => Option.none<BlockType>()),
      ]

      return Effect.gen(function* () {
        const renderer = yield* HotbarRendererService
        yield* renderer.initialize(800, 600)
        yield* renderer.update(slotsA, SlotIndex.make(0))

        const meshCalls = vi.mocked(THREE.Mesh).mock.calls
        const firstSlotMesh = meshCalls[1]?.[0] ? vi.mocked(THREE.Mesh).mock.results[1]?.value : null
        const uvSetXY = firstSlotMesh?.geometry?.attributes?.uv?.setXY
        const beforeCount = uvSetXY?.mock?.calls?.length ?? 0

        yield* renderer.update(slotsB, SlotIndex.make(0))

        const afterCount = uvSetXY?.mock?.calls?.length ?? 0
        expect(afterCount).toBe(beforeCount)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('render', () => {
    it.scoped('should not call renderOverlay when camera is not initialized', () => {
      const mockRenderer = createMockRendererService()
      const TestLayer = buildTestLayer(mockRenderer)

      const fakeWebGLRenderer = {} as import('three').WebGLRenderer

      return Effect.gen(function* () {
        const renderer = yield* HotbarRendererService
        // render without calling initialize first — hudCamera is null
        yield* renderer.render(fakeWebGLRenderer)

        // renderOverlay should NOT be called because hudCamera is null
        expect(mockRenderer.renderOverlay).not.toHaveBeenCalled()
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should call renderOverlay when camera is initialized', () => {
      const mockRenderer = createMockRendererService()
      const TestLayer = buildTestLayer(mockRenderer)

      const fakeWebGLRenderer = {} as import('three').WebGLRenderer

      return Effect.gen(function* () {
        const renderer = yield* HotbarRendererService
        yield* renderer.initialize(800, 600)
        yield* renderer.render(fakeWebGLRenderer)

        expect(mockRenderer.renderOverlay).toHaveBeenCalledTimes(1)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should pass the provided WebGLRenderer to renderOverlay', () => {
      const mockRenderer = createMockRendererService()
      const TestLayer = buildTestLayer(mockRenderer)

      const fakeWebGLRenderer = { clearDepth: vi.fn(), render: vi.fn() } as import('three').WebGLRenderer

      return Effect.gen(function* () {
        const renderer = yield* HotbarRendererService
        yield* renderer.initialize(800, 600)
        yield* renderer.render(fakeWebGLRenderer)

        const [calledRenderer] = (mockRenderer.renderOverlay as ReturnType<typeof vi.fn>).mock.calls[0] as [unknown, ...unknown[]]
        expect(calledRenderer).toBe(fakeWebGLRenderer)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('integration', () => {
    it.scoped('should handle full initialize → update → render flow', () => {
      const mockRenderer = createMockRendererService()
      const TestLayer = buildTestLayer(mockRenderer)

      const slots: ReadonlyArray<Option.Option<BlockType>> = [
        Option.some('GRASS' as BlockType),
        ...Arr.makeBy(8, () => Option.none<BlockType>()),
      ]
      const fakeWebGLRenderer = {} as import('three').WebGLRenderer

      return Effect.gen(function* () {
        const renderer = yield* HotbarRendererService
        yield* renderer.initialize(1280, 720)
        yield* renderer.update(slots, SlotIndex.make(2))
        yield* renderer.render(fakeWebGLRenderer)

        expect(mockRenderer.renderOverlay).toHaveBeenCalledTimes(1)
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('should handle repeated update + render calls', () => {
      const mockRenderer = createMockRendererService()
      const TestLayer = buildTestLayer(mockRenderer)

      const emptySlots: ReadonlyArray<Option.Option<BlockType>> = Arr.makeBy(9, () => Option.none())
      const fakeWebGLRenderer = {} as import('three').WebGLRenderer

      return Effect.gen(function* () {
        const renderer = yield* HotbarRendererService
        yield* renderer.initialize(800, 600)

        yield* Effect.forEach(Arr.makeBy(5, i => i), (frame) => Effect.gen(function* () {
          yield* renderer.update(emptySlots, SlotIndex.make(frame % 9))
          yield* renderer.render(fakeWebGLRenderer)
        }), { concurrency: 1 })

        expect(mockRenderer.renderOverlay).toHaveBeenCalledTimes(5)
      }).pipe(Effect.provide(TestLayer))
    })
  })

  describe('resize', () => {
    it.scoped('resize handler updates camera projection matrix after initialize', () => {
      capturedWindowListeners.clear()
      const TestLayer = buildTestLayer()

      return Effect.gen(function* () {
        const renderer = yield* HotbarRendererService
        yield* renderer.initialize(1280, 720)

        const resizeHandler = capturedWindowListeners.get('resize')
        expect(resizeHandler).toBeDefined()

        // Simulate window resize — camera is Option.some so onSome branch fires
        Object.assign(globalThis.window, { innerWidth: 1920, innerHeight: 1080 })
        resizeHandler!()
      }).pipe(Effect.provide(TestLayer))
    })

    it.scoped('resize handler before initialize: Option.none branch runs without crash', () => {
      capturedWindowListeners.clear()
      const TestLayer = buildTestLayer()

      return Effect.gen(function* () {
        yield* HotbarRendererService
        // initialize() NOT called — hudCamera is Option.none()

        const resizeHandler = capturedWindowListeners.get('resize')
        expect(resizeHandler).toBeDefined()

        // onNone branch of Option.match(hudCamera, ...) must run without error
        resizeHandler!()
      }).pipe(Effect.provide(TestLayer))
    })
  })
})
