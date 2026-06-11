import { Effect } from 'effect'
import * as THREE from 'three'
import { LIMB_SWING_AMPLITUDE } from '../entity/walk-cycle'

export interface RemotePlayerState {
  readonly playerId: string
  readonly playerName: string
  readonly position: { x: number; y: number; z: number }
  readonly rotation: { yaw: number; pitch: number }
  readonly limbSwing: number
}

export type RemotePlayerRenderer = {
  readonly addPlayer: (state: RemotePlayerState) => Effect.Effect<void, never>
  readonly updatePlayer: (playerId: string, state: RemotePlayerState) => Effect.Effect<void, never>
  readonly removePlayer: (playerId: string) => Effect.Effect<void, never>
  readonly updateFromSnapshot: (snapshots: ReadonlyArray<RemotePlayerState>) => Effect.Effect<void, never>
  readonly getAllPlayerIds: Effect.Effect<Set<string>, never>
}

type PlayerParts = Readonly<{
  root: THREE.Group
  leftArm: THREE.Mesh
  rightArm: THREE.Mesh
  leftLeg: THREE.Mesh
  rightLeg: THREE.Mesh
}>

type RemotePlayerEntry = Readonly<{
  group: THREE.Group
  parts: PlayerParts
}>

const PLAYER_HEIGHT = 1.8
const NAME_TAG_Y = 2.15

const createBox = (
  size: readonly [number, number, number],
  color: number,
): THREE.Mesh => new THREE.Mesh(
  new THREE.BoxGeometry(size[0], size[1], size[2]),
  new THREE.MeshBasicMaterial({ color }),
)

const createPivotedLimb = (
  size: readonly [number, number, number],
  color: number,
): THREE.Mesh => {
  const geometry = new THREE.BoxGeometry(size[0], size[1], size[2])
  geometry.translate(0, -size[1] / 2, 0)
  return new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ color }))
}

const createNameTag = (name: string): THREE.Sprite => {
  const canvas = globalThis.document?.createElement('canvas')
  if (canvas !== undefined) {
    canvas.width = 256
    canvas.height = 64
    const ctx = canvas.getContext('2d')
    if (ctx !== null) {
      ctx.fillStyle = 'rgba(0, 0, 0, 0.55)'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      ctx.fillStyle = '#ffffff'
      ctx.font = '28px sans-serif'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(name, canvas.width / 2, canvas.height / 2)
    }
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }))
    sprite.scale.set(1.6, 0.4, 1)
    sprite.position.set(0, NAME_TAG_Y, 0)
    return sprite
  }
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ color: 0xffffff }))
  sprite.scale.set(1.0, 0.25, 1)
  sprite.position.set(0, NAME_TAG_Y, 0)
  return sprite
}

const createPlayerParts = (state: RemotePlayerState): PlayerParts => {
  const root = new THREE.Group()

  const body = createBox([0.5, 0.75, 0.25], 0x2f66d0)
  body.position.set(0, 1.125, 0)
  root.add(body)

  const head = createBox([0.45, 0.45, 0.45], 0xd8b08a)
  head.position.set(0, PLAYER_HEIGHT - 0.225, 0)
  root.add(head)

  const leftArm = createPivotedLimb([0.18, 0.75, 0.18], 0xd8b08a)
  leftArm.position.set(0.34, 1.5, 0)
  root.add(leftArm)

  const rightArm = createPivotedLimb([0.18, 0.75, 0.18], 0xd8b08a)
  rightArm.position.set(-0.34, 1.5, 0)
  root.add(rightArm)

  const leftLeg = createPivotedLimb([0.2, 0.75, 0.2], 0x3d4f86)
  leftLeg.position.set(0.12, 0.75, 0)
  root.add(leftLeg)

  const rightLeg = createPivotedLimb([0.2, 0.75, 0.2], 0x3d4f86)
  rightLeg.position.set(-0.12, 0.75, 0)
  root.add(rightLeg)

  root.add(createNameTag(state.playerName))
  return { root, leftArm, rightArm, leftLeg, rightLeg }
}

// scene.remove() only detaches from the graph — it does NOT free GPU memory.
// Every per-player BoxGeometry / MeshBasicMaterial and the name-tag's
// SpriteMaterial + CanvasTexture are OWNED (built inline in createPlayerParts,
// never shared/cached), so they must be disposed on despawn or VRAM grows
// unbounded across multiplayer join/leave churn.
const disposeMaterial = (material: THREE.Material): void => {
  const map = (material as THREE.SpriteMaterial).map
  if (map) map.dispose()
  material.dispose()
}

const disposeEntry = (entry: RemotePlayerEntry): void => {
  entry.group.traverse((object) => {
    const geometry = (object as Partial<THREE.Mesh>).geometry
    if (geometry) geometry.dispose()
    const material = (object as Partial<THREE.Mesh>).material
    if (Array.isArray(material)) material.forEach(disposeMaterial)
    else if (material) disposeMaterial(material)
  })
}

const applyState = (entry: RemotePlayerEntry, state: RemotePlayerState): void => {
  entry.group.position.set(state.position.x, state.position.y, state.position.z)
  entry.group.rotation.y = state.rotation.yaw
  entry.parts.root.rotation.x = state.rotation.pitch

  const swing = Math.sin(state.limbSwing) * LIMB_SWING_AMPLITUDE
  entry.parts.leftLeg.rotation.x = swing
  entry.parts.rightLeg.rotation.x = -swing
  entry.parts.leftArm.rotation.x = -swing
  entry.parts.rightArm.rotation.x = swing
}

export const createRemotePlayerRenderer = (
  scene: Pick<THREE.Scene, 'add' | 'remove'>,
  camera: THREE.Camera,
): RemotePlayerRenderer => {
  void camera
  const players = new Map<string, RemotePlayerEntry>()

  const addPlayer = (state: RemotePlayerState): Effect.Effect<void, never> =>
    Effect.sync(() => {
      const existing = players.get(state.playerId)
      if (existing !== undefined) {
        applyState(existing, state)
        return
      }
      const parts = createPlayerParts(state)
      const group = new THREE.Group()
      group.add(parts.root)
      const entry = { group, parts }
      applyState(entry, state)
      players.set(state.playerId, entry)
      scene.add(group)
    })

  return {
    addPlayer,
    updatePlayer: (playerId, state) => Effect.sync(() => {
      const entry = players.get(playerId)
      if (entry === undefined) return
      applyState(entry, state)
    }),
    removePlayer: (playerId) => Effect.sync(() => {
      const entry = players.get(playerId)
      if (entry === undefined) return
      scene.remove(entry.group)
      disposeEntry(entry)
      players.delete(playerId)
    }),
    updateFromSnapshot: (snapshots) => Effect.sync(() => {
      const liveIds = new Set(snapshots.map((snapshot) => snapshot.playerId))
      for (const snapshot of snapshots) Effect.runSync(addPlayer(snapshot))
      for (const [playerId, entry] of players) {
        if (liveIds.has(playerId)) continue
        scene.remove(entry.group)
        disposeEntry(entry)
        players.delete(playerId)
      }
    }),
    getAllPlayerIds: Effect.sync(() => new Set(players.keys())),
  }
}
