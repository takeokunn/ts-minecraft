import { Effect, Layer } from 'effect'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import * as THREE from 'three'
import Stats from 'three/examples/jsm/libs/stats.module.js'
import { ThreeContextLive } from '../context'
import { ThreeContextService } from '../../types'
import { ThreeCameraService } from '../../camera-three'

// Mocks
const mockScene = { add: vi.fn() }
const mockRenderer = {
  setSize: vi.fn(),
  domElement: document.createElement('canvas'),
  dispose: vi.fn(),
}
const mockStats = {
  dom: document.createElement('div'),
}

vi.mock('three', async () => {
  const actual = await vi.importActual('three')
  return {
    ...actual,
    Scene: vi.fn(() => mockScene),
    WebGLRenderer: vi.fn(() => mockRenderer),
    Mesh: vi.fn(),
    BoxGeometry: vi.fn(),
    MeshBasicMaterial: vi.fn(),
    PerspectiveCamera: vi.fn(),
  }
})
vi.mock('three/examples/jsm/libs/stats.module.js', () => ({
  default: vi.fn(() => mockStats),
}))

const mockCamera = new THREE.PerspectiveCamera()
const mockThreeCameraService = {
  camera: { camera: mockCamera },
  handleResize: vi.fn(() => Effect.void),
}

const ThreeCameraServiceMock = Layer.succeed(ThreeCameraService, mockThreeCameraService as any)

describe('ThreeContextLive', () => {
  let rootElement: HTMLElement
  let resizeHandler: (() => void) | undefined

  beforeEach(() => {
    rootElement = document.createElement('div')
    document.body.appendChild(rootElement)
    vi.clearAllMocks()

    resizeHandler = undefined
    const addSpy = vi.spyOn(window, 'addEventListener')
    addSpy.mockImplementation((event, handler) => {
      if (event === 'resize') {
        resizeHandler = handler as () => void
      }
    })
  })

  it('should acquire and release resources correctly', async () => {
    const layer = Layer.provide(ThreeContextLive(rootElement), ThreeCameraServiceMock)
    const program = Effect.scoped(
      Effect.gen(function* (_) {
        yield* _(ThreeContextService)
        expect(THREE.Scene).toHaveBeenCalledOnce()
        expect(THREE.WebGLRenderer).toHaveBeenCalledOnce()
        expect(Stats).toHaveBeenCalledOnce()
        expect(mockRenderer.setSize).toHaveBeenCalledWith(window.innerWidth, window.innerHeight)
        expect(mockScene.add).toHaveBeenCalledWith(expect.any(THREE.Mesh))
        expect(rootElement.children.length).toBe(2)
        expect(rootElement.contains(mockRenderer.domElement)).toBe(true)
        expect(rootElement.contains(mockStats.dom)).toBe(true)
      }),
    )

    await Effect.runPromise(Effect.provide(program, layer))

    expect(mockRenderer.dispose).toHaveBeenCalledOnce()
    expect(rootElement.children.length).toBe(0)
  })

  it('should add and remove resize listener', async () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const layer = Layer.provide(ThreeContextLive(rootElement), ThreeCameraServiceMock)

    const program = Effect.scoped(
      Effect.gen(function* (_) {
        yield* _(ThreeContextService)
        expect(addSpy).toHaveBeenCalledWith('resize', expect.any(Function))
      }),
    )

    await Effect.runPromise(Effect.provide(program, layer))
    expect(removeSpy).toHaveBeenCalledWith('resize', expect.any(Function))
  })

  it('should call handleResize on window resize', async () => {
    const layer = Layer.provide(ThreeContextLive(rootElement), ThreeCameraServiceMock)
    const program = Effect.scoped(
      Effect.gen(function* (_) {
        yield* _(ThreeContextService)
        expect(resizeHandler).toBeDefined()

        if (resizeHandler) {
          resizeHandler()
        }
        expect(mockThreeCameraService.handleResize).toHaveBeenCalledWith(mockRenderer)
        expect(mockThreeCameraService.handleResize).toHaveBeenCalledTimes(1)
      }),
    )
    await Effect.runPromise(Effect.provide(program, layer))
  })

  it('should provide a valid ThreeContext', async () => {
    const layer = Layer.provide(ThreeContextLive(rootElement), ThreeCameraServiceMock)
    const program = Effect.scoped(
      Effect.gen(function* (_) {
        const context = yield* _(ThreeContextService)
        expect(context).toBeDefined()
        expect(context.scene).toBe(mockScene)
        expect(context.renderer).toBe(mockRenderer)
        expect(context.stats).toBe(mockStats)
        expect(context.camera.camera).toBe(mockCamera)
        expect(context.highlightMesh).toBeInstanceOf(THREE.Mesh)
        expect(context.chunkMeshes).toBeInstanceOf(Map)
        expect(context.instancedMeshes).toBeInstanceOf(Map)
      }),
    )
    await Effect.runPromise(Effect.provide(program, layer))
  })
})
