import * as THREE from 'three'

import { BLOCK } from './constant'
import { BlockInterface } from './blocks'

export const isCollideCameraAndBlock = (camera: THREE.PerspectiveCamera, block: BlockInterface): boolean => {
  return (
    camera.position.x <= block.position.x + BLOCK.SIZE / 2 &&
    camera.position.x >= block.position.x - BLOCK.SIZE / 2 &&
    camera.position.z <= block.position.z + BLOCK.SIZE / 2 &&
    camera.position.z >= block.position.z - BLOCK.SIZE / 2
  )
}
