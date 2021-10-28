import * as THREE from 'three'

import { faces } from '@src/assets'
import { BLOCK } from '@src/constant'
import { Chunks } from '@src/terrian'
import { BlockInterface } from '@src/blocks'

export const isCollideCameraAndBlock = (camera: THREE.PerspectiveCamera, block: BlockInterface): boolean => {
  return (
    camera.position.x <= block.position.x + BLOCK.SIZE / 2 &&
    camera.position.x >= block.position.x - BLOCK.SIZE / 2 &&
    camera.position.z <= block.position.z + BLOCK.SIZE / 2 &&
    camera.position.z >= block.position.z - BLOCK.SIZE / 2
  )
}

const isNeighborhood = (
  x: THREE.Vector3['x'],
  y: THREE.Vector3['y'],
  z: THREE.Vector3['z'],
  chunks: Chunks,
): boolean => {
  return chunks.reduce<boolean>(
    (accum, block) => accum || (x === block.position.x && y === block.position.y && z === block.position.z),
    false,
  )
}

export const adjustBlockFaces = (block: BlockInterface, chunks: Chunks): DirectionName[] => {
  return faces
    .filter((face) =>
      isNeighborhood(
        block.position.x + face.direction.x,
        block.position.y + face.direction.y,
        block.position.z + face.direction.z,
        chunks,
      ),
    )
    .map((face) => face.name)
}
