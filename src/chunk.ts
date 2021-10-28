import * as THREE from 'three'
import SimplexNoise from 'simplex-noise'

import { BLOCK, TERRIAN } from '@src/constant'
import { Dart, Grass, BlockInterface } from '@src/blocks'

interface ChunkInterface {
  blocks: BlockInterface[]
}

class Chunk implements ChunkInterface {
  public blocks: BlockInterface[] = []

  constructor(simplex: SimplexNoise, centerX: number, centerZ: number) {
    for (let x = 0; x < TERRIAN.CHUNK_SIZE; x++) {
      for (let z = 0; z < TERRIAN.CHUNK_SIZE; z++) {
        const positionX = centerX + x
        const positionZ = centerZ + z
        const xoff = TERRIAN.INCREMENT_OFFSET * positionX
        const zoff = TERRIAN.INCREMENT_OFFSET * positionZ
        const y = Math.round((simplex.noise2D(xoff, zoff) * TERRIAN.AMPLITUDE) / BLOCK.SIZE)
        this.blocks.push(
          new Grass(new THREE.Vector3(positionX * BLOCK.SIZE, y * BLOCK.SIZE, positionZ * BLOCK.SIZE), true),
        )
        this.blocks.push(
          new Dart(new THREE.Vector3(positionX * BLOCK.SIZE, (y - 1) * BLOCK.SIZE, positionZ * BLOCK.SIZE), false),
        )
        this.blocks.push(
          new Dart(new THREE.Vector3(positionX * BLOCK.SIZE, (y - 2) * BLOCK.SIZE, positionZ * BLOCK.SIZE), false),
        )
      }
    }
  }
}

export { Chunk, ChunkInterface }
