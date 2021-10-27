import * as THREE from 'three'
import SimplexNoise from 'simplex-noise'

import { Dart, BlockInterface } from '@src/blocks'
import { BLOCK, TERRIAN, CAMERA } from './constant'

type Chunks = BlockInterface[]

interface TerrianInterface {
  chunks: Chunks
  generate: (xoff: number, zoff: number) => void
}

class Terrian implements TerrianInterface {
  private simplex: SimplexNoise
  public chunks: Chunks = []

  constructor() {
    this.simplex = new SimplexNoise(Math.random())
  }

  public generate(xoff: number, zoff: number): void {
    for (let outer = 0; outer < CAMERA.RENDER_DISTANCE; outer++) {
      for (let inner = 0; inner < CAMERA.RENDER_DISTANCE; inner++) {
        for (let x = outer * TERRIAN.CHUNK_SIZE; x < outer * TERRIAN.CHUNK_SIZE + TERRIAN.CHUNK_SIZE; x++) {
          for (let z = inner * TERRIAN.CHUNK_SIZE; z < inner * TERRIAN.CHUNK_SIZE + TERRIAN.CHUNK_SIZE; z++) {
            xoff = TERRIAN.INCREMENT_OFFSET * x
            zoff = TERRIAN.INCREMENT_OFFSET * z
            const y = Math.round((Math.abs(this.simplex.noise2D(xoff, zoff)) * TERRIAN.AMPLITUDE) / BLOCK.SIZE)
            this.chunks.push(new Dart(new THREE.Vector3(x * BLOCK.SIZE, y * BLOCK.SIZE, z * BLOCK.SIZE), false))
            this.chunks.push(new Dart(new THREE.Vector3(x * BLOCK.SIZE, (y - 1) * BLOCK.SIZE, z * BLOCK.SIZE), true))
          }
        }
      }
    }
  }
}

export { Terrian, TerrianInterface, Chunks }
