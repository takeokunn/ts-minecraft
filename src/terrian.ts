import { createNoise2D, NoiseFunction2D } from 'simplex-noise'

import { Chunk } from '@src/chunk'
import { Block } from '@src/blocks'
import { TERRIAN } from '@src/constant'

interface TerrianInterface {
  chunks: Chunk[]
  generate: () => void
  getChunkBlocks: () => Block[]
}

class Terrian implements TerrianInterface {
  private noise2D: NoiseFunction2D
  public chunks: Chunk[] = []

  constructor() {
    this.noise2D = createNoise2D()
  }

  public generate(): void {
    this.chunks.push(new Chunk(this.noise2D, 0, 0))
    this.chunks.push(new Chunk(this.noise2D, -TERRIAN.CHUNK_SIZE, 0))
    this.chunks.push(new Chunk(this.noise2D, 0, -TERRIAN.CHUNK_SIZE))
    this.chunks.push(new Chunk(this.noise2D, -TERRIAN.CHUNK_SIZE, -TERRIAN.CHUNK_SIZE))
  }

  public getChunkBlocks(): Block[] {
    return this.chunks.map((chunk) => chunk.blocks).flat()
  }
}

export { Terrian }
