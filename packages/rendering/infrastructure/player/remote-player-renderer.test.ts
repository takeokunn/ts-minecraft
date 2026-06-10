import { Effect } from 'effect'
import { describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import { createRemotePlayerRenderer, type RemotePlayerState } from './remote-player-renderer'

type MockVector = { x: number; y: number; z: number; set: (x: number, y: number, z: number) => void }
type MockObject3D = {
  readonly children: Array<MockObject3D>
  readonly position: MockVector
  readonly rotation: { x: number; y: number; z: number }
  readonly scale: MockVector
  readonly add: (object: MockObject3D) => void
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
  }

  class BoxGeometryMock {
    readonly translate = vi.fn()
    constructor(readonly width: number, readonly height: number, readonly depth: number) {}
  }

  class MeshBasicMaterialMock {
    constructor(readonly options: unknown) {}
  }

  class SpriteMaterialMock {
    constructor(readonly options: unknown) {}
  }

  class CanvasTextureMock {
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

describe('infrastructure/player/remote-player-renderer', () => {
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

  it('removePlayer removes from scene and internal map', () => {
    const scene = makeScene()
    const renderer = createRemotePlayerRenderer(scene, new THREE.Camera())

    Effect.runSync(renderer.addPlayer(makeState()))
    const group = addedGroup(scene)
    Effect.runSync(renderer.removePlayer('player-1'))

    expect(scene.remove).toHaveBeenCalledWith(group)
    expect(Effect.runSync(renderer.getAllPlayerIds).size).toBe(0)
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
