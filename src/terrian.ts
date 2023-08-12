import { createNoise2D, NoiseFunction2D } from 'simplex-noise'

import { TERRIAN } from '@src/constant'
import { BlockInterface } from '@src/blocks'
import { Chunk, ChunkInterface } from '@src/chunk'

interface TerrianInterface {
  chunks: ChunkInterface[]
  generate: () => void
  getChunkBlocks: () => BlockInterface[]
}

class Terrian implements TerrianInterface {
  private noise2D: NoiseFunction2D
  public chunks: ChunkInterface[] = []

  constructor() {
    this.noise2D = createNoise2D()
  }

  public generate(): void {
    this.chunks.push(new Chunk(this.noise2D, 0, 0))
    this.chunks.push(new Chunk(this.noise2D, -TERRIAN.CHUNK_SIZE, 0))
    this.chunks.push(new Chunk(this.noise2D, 0, -TERRIAN.CHUNK_SIZE))
    this.chunks.push(new Chunk(this.noise2D, -TERRIAN.CHUNK_SIZE, -TERRIAN.CHUNK_SIZE))
  }

  public getChunkBlocks(): BlockInterface[] {
    return this.chunks.map((chunk) => chunk.blocks).flat()
  }
}

export { Terrian, TerrianInterface }
