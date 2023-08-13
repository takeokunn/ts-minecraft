import { PerspectiveCamera, Vector3 } from 'three'
import Stats from 'three/examples/jsm/libs/stats.module'

import { faces } from '@src/assets'
import { Block } from '@src/blocks'
import { BLOCK } from '@src/constant'

export const createStats = (): Stats => {
  const stats = new Stats()
  stats.showPanel(0)
  document.body.appendChild(stats.dom)

  return stats
}

export const isCollideCameraAndBlock = (camera: PerspectiveCamera, block: Block): boolean => {
  return (
    camera.position.x <= block.position.x + BLOCK.SIZE / 2 &&
    camera.position.x >= block.position.x - BLOCK.SIZE / 2 &&
    camera.position.z <= block.position.z + BLOCK.SIZE / 2 &&
    camera.position.z >= block.position.z - BLOCK.SIZE / 2
  )
}

const isNeighborhood = (x: Vector3['x'], y: Vector3['y'], z: Vector3['z'], blocks: Block[]): boolean => {
  return blocks.reduce<boolean>(
    (accum, block) => accum || (x === block.position.x && y === block.position.y && z === block.position.z),
    false,
  )
}

export const adjustBlockFaces = (block: Block, blocks: Block[]): DirectionName[] => {
  return faces
    .filter((face) =>
      isNeighborhood(
        block.position.x + face.direction.x,
        block.position.y + face.direction.y,
        block.position.z + face.direction.z,
        blocks,
      ),
    )
    .map((face) => face.name)
}
