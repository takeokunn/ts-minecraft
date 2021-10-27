import * as THREE from 'three'
import SimplexNoise from 'simplex-noise'

import { BLOCK, TERRIAN } from '@src/constant'
import { Dart, Grass, BlockInterface } from '@src/blocks'

type Chunks = BlockInterface[]

interface TerrianInterface {
  chunks: Chunks
  generate: (centerX: number, centerZ: number) => void
}

class Terrian implements TerrianInterface {
  private simplex: SimplexNoise
  public chunks: Chunks = []

  constructor() {
    this.simplex = new SimplexNoise(Math.random())
  }

  public generate(centerX: number, centerZ: number): void {
    for (let x = 0; x < TERRIAN.CHUNK_SIZE * 2; x++) {
      for (let z = 0; z < TERRIAN.CHUNK_SIZE * 2; z++) {
        const xoff = TERRIAN.INCREMENT_OFFSET * x
        const zoff = TERRIAN.INCREMENT_OFFSET * z
        const y = Math.round((Math.abs(this.simplex.noise2D(xoff, zoff)) * TERRIAN.AMPLITUDE) / BLOCK.SIZE)
        this.chunks.push(
          new Grass(new THREE.Vector3(centerX + x * BLOCK.SIZE, y * BLOCK.SIZE, centerZ + z * BLOCK.SIZE), true),
        )
        this.chunks.push(
          new Dart(new THREE.Vector3(centerX + x * BLOCK.SIZE, (y - 1) * BLOCK.SIZE, centerZ + z * BLOCK.SIZE), false),
        )
      }
    }
  }
}

export { Terrian, TerrianInterface, Chunks }
