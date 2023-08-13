import { match } from 'ts-pattern'
import { DoubleSide, Intersection, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three'

import { color } from '@src/assets'
import { BLOCK } from '@src/constant'

const FaceIndex = {
  Right: 0,
  Left: 1,
  Top: 2,
  Bottom: 3,
  Front: 4,
  Back: 5,
} as const

type PlaneType = {
  position: {
    x: number
    y: number
    z: number
  }
  rotation: {
    x: number
    y: number
    z: number
  }
}

interface PlaneInterface {
  updateCord: (intersect: Intersection) => void
}

class Plane extends Mesh implements PlaneInterface {
  constructor() {
    super()

    this.geometry = new PlaneGeometry(BLOCK.SIZE / 2, BLOCK.SIZE / 2)
    this.material = new MeshBasicMaterial({ color: color.white, side: DoubleSide })
  }

  public updateCord(intersect: Intersection): void {
    const position = intersect.point
    const materialIndex = intersect.face?.materialIndex

    const plane = match<number | undefined, PlaneType>(materialIndex)
      .with(FaceIndex.Right, () => ({
        position: { x: position.x, y: Math.round(position.y / 5) * 5, z: Math.round(position.z / 5) * 5 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
      }))
      .with(FaceIndex.Left, () => ({
        position: { x: position.x, y: Math.round(position.y / 5) * 5, z: Math.round(position.z / 5) * 5 },
        rotation: { x: 0, y: Math.PI / 2, z: 0 },
      }))
      .with(FaceIndex.Top, () => ({
        position: { x: Math.round(position.x / 5) * 5, y: position.y, z: Math.round(position.z / 5) * 5 },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
      }))
      .with(FaceIndex.Bottom, () => ({
        position: { x: Math.round(position.x / 5) * 5, y: position.y, z: Math.round(position.z / 5) * 5 },
        rotation: { x: Math.PI / 2, y: 0, z: 0 },
      }))
      .with(FaceIndex.Front, () => ({
        position: { x: Math.round(position.x / 5) * 5, y: Math.round(position.y / 5) * 5, z: position.z },
        rotation: { x: 0, y: 0, z: 0 },
      }))
      .with(FaceIndex.Back, () => ({
        position: { x: Math.round(position.x / 5) * 5, y: Math.round(position.y / 5) * 5, z: position.z },
        rotation: { x: 0, y: 0, z: 0 },
      }))
      .otherwise(() => ({
        position: { x: 0, y: 0, z: 0 },
        rotation: { x: 0, y: 0, z: 0 },
      }))

    this.position.x = plane.position.x
    this.position.y = plane.position.y
    this.position.z = plane.position.z
    this.rotation.x = plane.rotation.x
    this.rotation.y = plane.rotation.y
    this.rotation.z = plane.rotation.z
  }
}

export { Plane }
