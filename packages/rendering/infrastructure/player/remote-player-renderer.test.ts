import { Effect } from 'effect'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createRemotePlayerRenderer, type RemotePlayerState } from './remote-player-renderer'

type MockVector = { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void }
type MockObject3D = {
  readonly children: Array<MockObject3D>
  readonly position: MockVector
  readonly rotation: { x: number; y: number; z: number }
  readonly scale: MockVector
  readonly add: (object: MockObject3D) => void
  readonly traverse: (callback: (object: MockObject3D) => void) => void
}

vi.mock('three', () => {
  const makeVector = (x = 0, y = 0, z = 0): MockVector => ({
    x,
    y,
    z,
    set(nx, ny, nz): void {
      this.x = nx
      this.y = ny
      this.z = nz
    },
  })

  class Object3DMock implements MockObject3D {
    readonly children: Array<MockObject3D> = []
    readonly position = makeVector()
    readonly rotation = { x: 0, y: 0, z: 0 }
    readonly scale = makeVector(1, 1, 1)
    readonly add = vi.fn((object: MockObject3D): void => {
      this.children.push(object)
    })
    traverse(callback: (object: MockObject3D) => void): void {
      callback(this)
      for (const child of this.children) child.traverse(callback)
    }
  }

  class BoxGeometryMock {
    readonly translate = vi.fn()
    readonly dispose = vi.fn()
    constructor(readonly width: number, readonly height: number, readonly depth: number) {}
  }

  class MeshBasicMaterialMock {
    readonly dispose = vi.fn()
    constructor(readonly options: unknown) {}
  }

  class SpriteMaterialMock {
    readonly dispose = vi.fn()
    readonly map: unknown
    constructor(readonly options: { map?: unknown }) {
      this.map = options?.map
    }
  }

  class CanvasTextureMock {
    readonly dispose = vi.fn()
    constructor(readonly canvas: unknown) {}
  }

  return {
    Group: Object3DMock,
    Mesh: class MeshMock extends Object3DMock {
      constructor(readonly geometry: unknown, readonly material: unknown) { super() }
    },
    Sprite: class SpriteMock extends Object3DMock {
      constructor(readonly material: unknown) { super() }
    },
    BoxGeometry: BoxGeometryMock,
    MeshBasicMaterial: MeshBasicMaterialMock,
    SpriteMaterial: SpriteMaterialMock,
    CanvasTexture: CanvasTextureMock,
    Camera: class CameraMock extends Object3DMock {},
  }
})

const makeState = (overrides: Partial<RemotePlayerState> = {}): RemotePlayerState => ({
  playerId: 'player-1',
  playerName: 'Steve',
  position: { x: 1, y: 64, z: 2 },
  rotation: { yaw: 0.5, pitch: 0.1 },
  limbSwing: 0,
  ...overrides,
})

const makeScene = (): Pick<THREE.Scene, 'add' | 'remove'> => ({
  add: vi.fn(),
  remove: vi.fn(),
})

const addedGroup = (scene: Pick<THREE.Scene, 'add' | 'remove'>): MockObject3D => {
  const add = scene.add as ReturnType<typeof vi.fn>
  return add.mock.calls[0]?.[0] as MockObject3D
}

const makeCanvasDocument = (context: object | null) => ({
  createElement: vi.fn((tagName: string) => {
    expect(tagName).toBe('canvas')
    return {
      width: 0,
      height: 0,
      getContext: vi.fn((type: string) => {
        expect(type).toBe('2d')
        return context
      }),
    }
  }),
})

// Walk a player group and collect every GPU resource that owns a dispose() —
// geometries, materials, and any texture map hanging off a SpriteMaterial.
const collectDisposables = (group: MockObject3D): Array<{ dispose: ReturnType<typeof vi.fn> }> => {
  const disposables: Array<{ dispose: ReturnType<typeof vi.fn> }> = []
  group.traverse((object) => {
    const o = object as unknown as {
      geometry?: { dispose: ReturnType<typeof vi.fn> }
      material?: { dispose: ReturnType<typeof vi.fn>; map?: { dispose: ReturnType<typeof vi.fn> } }
    }
    if (o.geometry) disposables.push(o.geometry)
    if (o.material) {
      disposables.push(o.material)
      if (o.material.map) disposables.push(o.material.map)
    }
  })
  return disposables
}

describe('infrastructure/player/remote-player-renderer', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('addPlayer creates a THREE.Group and adds it to the scene', () => {
    const scene = makeScene()
    const renderer = createRemotePlayerRenderer(scene, new THREE.Camera())

    Effect.runSync(renderer.addPlayer(makeState()))

    expect(scene.add).toHaveBeenCalledTimes(1)
    expect(addedGroup(scene).children.length).toBe(1)
  })

  it('addPlayer sets position from state', () => {
    const scene = makeScene()
    const renderer = createRemotePlayerRenderer(scene, new THREE.Camera())

    Effect.runSync(renderer.addPlayer(makeState({ position: { x: 4, y: 70, z: -8 } })))

    expect(addedGroup(scene).position).toMatchObject({ x: 4, y: 70, z: -8 })
  })

  it('updatePlayer changes position', () => {
    const scene = makeScene()
    const renderer = createRemotePlayerRenderer(scene, new THREE.Camera())

    Effect.runSync(renderer.addPlayer(makeState()))
    Effect.runSync(renderer.updatePlayer('player-1', makeState({ position: { x: 9, y: 65, z: 3 } })))

    expect(addedGroup(scene).position).toMatchObject({ x: 9, y: 65, z: 3 })
  })

  it('addPlayer updates an existing player instead of adding another scene node', () => {
    const scene = makeScene()
    const renderer = createRemotePlayerRenderer(scene, new THREE.Camera())

    Effect.runSync(renderer.addPlayer(makeState()))
    Effect.runSync(renderer.addPlayer(makeState({ position: { x: -3, y: 72, z: 11 }, rotation: { yaw: 1.2, pitch: -0.2 } })))

    expect(scene.add).toHaveBeenCalledTimes(1)
    expect(addedGroup(scene).position).toMatchObject({ x: -3, y: 72, z: 11 })
    expect(addedGroup(scene).rotation.y).toBe(1.2)
    expect(addedGroup(scene).children[0]?.rotation.x).toBe(-0.2)
  })

  it('updatePlayer and removePlayer ignore unknown player IDs', () => {
    const scene = makeScene()
    const renderer = createRemotePlayerRenderer(scene, new THREE.Camera())

    Effect.runSync(renderer.updatePlayer('missing', makeState()))
    Effect.runSync(renderer.removePlayer('missing'))

    expect(scene.add).not.toHaveBeenCalled()
    expect(scene.remove).not.toHaveBeenCalled()
    expect(Effect.runSync(renderer.getAllPlayerIds)).toEqual(new Set())
  })

  it('removePlayer removes from scene and internal map', () => {
    const scene = makeScene()
    const renderer = createRemotePlayerRenderer(scene, new THREE.Camera())

    Effect.runSync(renderer.addPlayer(makeState()))
    const group = addedGroup(scene)
    Effect.runSync(renderer.removePlayer('player-1'))

    expect(scene.remove).toHaveBeenCalledWith(group)
    expect(Effect.runSync(renderer.getAllPlayerIds).size).toBe(0)
  })

  it('removePlayer disposes every owned geometry, material, and name-tag texture', () => {
    const scene = makeScene()
    const renderer = createRemotePlayerRenderer(scene, new THREE.Camera())

    Effect.runSync(renderer.addPlayer(makeState()))
    const disposables = collectDisposables(addedGroup(scene))
    // 6 box geometries + 6 mesh materials + 1 name-tag SpriteMaterial. The node
    // test env has no `document`, so createNameTag uses the texture-less fallback
    // sprite; in a browser the SpriteMaterial also carries a CanvasTexture map,
    // which disposeMaterial() disposes via its `if (map)` guard.
    expect(disposables.length).toBe(13)

    Effect.runSync(renderer.removePlayer('player-1'))

    for (const resource of disposables) expect(resource.dispose).toHaveBeenCalledTimes(1)
  })

  it('removePlayer disposes mesh material arrays', () => {
    const scene = makeScene()
    const renderer = createRemotePlayerRenderer(scene, new THREE.Camera())

    Effect.runSync(renderer.addPlayer(makeState()))
    const materialA = { dispose: vi.fn() }
    const materialB = { dispose: vi.fn() }
    const multiMaterialNode = Object.assign(new THREE.Group(), {
      material: [materialA, materialB],
    }) as unknown as MockObject3D
    addedGroup(scene).add(multiMaterialNode)

    Effect.runSync(renderer.removePlayer('player-1'))

    expect(materialA.dispose).toHaveBeenCalledTimes(1)
    expect(materialB.dispose).toHaveBeenCalledTimes(1)
  })

  it('creates and disposes the canvas-backed name-tag texture when document is available', () => {
    const context = {
      fillStyle: '',
      font: '',
      textAlign: '',
      textBaseline: '',
      fillRect: vi.fn(),
      fillText: vi.fn(),
    }
    vi.stubGlobal('document', makeCanvasDocument(context))
    const scene = makeScene()
    const renderer = createRemotePlayerRenderer(scene, new THREE.Camera())

    Effect.runSync(renderer.addPlayer(makeState({ playerName: 'Alex' })))
    const disposables = collectDisposables(addedGroup(scene))

    expect(context.fillRect).toHaveBeenCalledWith(0, 0, 256, 64)
    expect(context.fillText).toHaveBeenCalledWith('Alex', 128, 32)
    expect(disposables.length).toBe(14)

    Effect.runSync(renderer.removePlayer('player-1'))

    for (const resource of disposables) expect(resource.dispose).toHaveBeenCalledTimes(1)
  })

  it('creates a canvas-backed name tag even when a 2d context is unavailable', () => {
    vi.stubGlobal('document', makeCanvasDocument(null))
    const scene = makeScene()
    const renderer = createRemotePlayerRenderer(scene, new THREE.Camera())

    Effect.runSync(renderer.addPlayer(makeState()))

    expect(scene.add).toHaveBeenCalledTimes(1)
    expect(collectDisposables(addedGroup(scene)).length).toBe(14)
  })

  it('updateFromSnapshot disposes resources of players that have left', () => {
    const scene = makeScene()
    const renderer = createRemotePlayerRenderer(scene, new THREE.Camera())

    Effect.runSync(renderer.addPlayer(makeState({ playerId: 'gone', playerName: 'Gone' })))
    const disposables = collectDisposables(addedGroup(scene))

    Effect.runSync(renderer.updateFromSnapshot([makeState({ playerId: 'stay', playerName: 'Stay' })]))

    expect(Effect.runSync(renderer.getAllPlayerIds)).toEqual(new Set(['stay']))
    for (const resource of disposables) expect(resource.dispose).toHaveBeenCalledTimes(1)
  })

  it('updateFromSnapshot adds new, updates existing, removes gone players', () => {
    const scene = makeScene()
    const renderer = createRemotePlayerRenderer(scene, new THREE.Camera())

    Effect.runSync(renderer.addPlayer(makeState({ playerId: 'old', playerName: 'Old' })))
    Effect.runSync(renderer.updateFromSnapshot([
      makeState({ playerId: 'old', playerName: 'Old', position: { x: 3, y: 4, z: 5 } }),
      makeState({ playerId: 'new', playerName: 'New', position: { x: 6, y: 7, z: 8 } }),
    ]))

    const ids = Effect.runSync(renderer.getAllPlayerIds)
    expect(ids).toEqual(new Set(['old', 'new']))
    expect(scene.add).toHaveBeenCalledTimes(2)
    expect(addedGroup(scene).position).toMatchObject({ x: 3, y: 4, z: 5 })

    Effect.runSync(renderer.updateFromSnapshot([makeState({ playerId: 'new', playerName: 'New' })]))

    expect(Effect.runSync(renderer.getAllPlayerIds)).toEqual(new Set(['new']))
    expect(scene.remove).toHaveBeenCalledTimes(1)
  })

  it('getAllPlayerIds returns current player IDs', () => {
    const scene = makeScene()
    const renderer = createRemotePlayerRenderer(scene, new THREE.Camera())

    Effect.runSync(renderer.addPlayer(makeState({ playerId: 'a', playerName: 'A' })))
    Effect.runSync(renderer.addPlayer(makeState({ playerId: 'b', playerName: 'B' })))

    expect(Effect.runSync(renderer.getAllPlayerIds)).toEqual(new Set(['a', 'b']))
  })
})
