import * as THREE from 'three'
import { PLAYER_HALF_HEIGHT } from '@ts-minecraft/core'

// While a vehicle modality is active (boating / minecarting) the rider sees a
// vehicle body at their feet — a boat hull or a minecart tub — instead of an
// invisible speed boost. One shared group per session, repositioned per frame;
// hidden whenever no vehicle is mounted. Both bodies are built from flat-color
// boxes in the same low-poly style as the remote-player avatar.
export type VehicleKind = 'boat' | 'minecart'

export type VehicleVisual = {
  readonly update: (
    kind: VehicleKind | null,
    position: { readonly x: number; readonly y: number; readonly z: number },
    yaw: number,
  ) => void
}

const box = (w: number, h: number, d: number, color: number, x = 0, y = 0, z = 0): THREE.Mesh => {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshLambertMaterial({ color }))
  mesh.position.set(x, y, z)
  return mesh
}

const OAK = 0x8b6b3d
const OAK_DARK = 0x6d5330
const IRON = 0x5c5c5c
const IRON_DARK = 0x3f3f3f

const buildBoat = (): THREE.Group => {
  const group = new THREE.Group()
  group.add(box(1.0, 0.12, 1.6, OAK_DARK, 0, 0.06, 0)) // hull floor
  group.add(box(0.14, 0.35, 1.6, OAK, -0.48, 0.28, 0)) // port side
  group.add(box(0.14, 0.35, 1.6, OAK, 0.48, 0.28, 0)) // starboard side
  group.add(box(1.0, 0.35, 0.14, OAK, 0, 0.28, -0.78)) // bow
  group.add(box(1.0, 0.35, 0.14, OAK, 0, 0.28, 0.78)) // stern
  return group
}

const buildMinecart = (): THREE.Group => {
  const group = new THREE.Group()
  group.add(box(0.9, 0.1, 1.2, IRON_DARK, 0, 0.1, 0)) // tub floor
  group.add(box(0.1, 0.45, 1.2, IRON, -0.45, 0.32, 0)) // left wall
  group.add(box(0.1, 0.45, 1.2, IRON, 0.45, 0.32, 0)) // right wall
  group.add(box(0.9, 0.45, 0.1, IRON, 0, 0.32, -0.6)) // front wall
  group.add(box(0.9, 0.45, 0.1, IRON, 0, 0.32, 0.6)) // back wall
  return group
}

export const createVehicleVisual = (scene: THREE.Scene): VehicleVisual => {
  const root = new THREE.Group()
  root.name = 'vehicle-visual'
  const boat = buildBoat()
  const minecart = buildMinecart()
  root.add(boat)
  root.add(minecart)
  root.visible = false
  boat.visible = false
  minecart.visible = false
  scene.add(root)

  return {
    update: (kind, position, yaw) => {
      if (kind === null) {
        if (root.visible) root.visible = false
        return
      }
      root.visible = true
      boat.visible = kind === 'boat'
      minecart.visible = kind === 'minecart'
      // player position is the body centre; the vehicle sits under the feet
      root.position.set(position.x, position.y - PLAYER_HALF_HEIGHT - 0.05, position.z)
      root.rotation.y = yaw
    },
  }
}
