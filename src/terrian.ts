import SimplexNoise from 'simplex-noise'

import { TERRIAN } from '@src/constant'
import { BlockInterface } from '@src/blocks'
import { Chunk, ChunkInterface } from '@src/chunk'

interface TerrianInterface {
  chunks: ChunkInterface[]
  generate: () => void
  getChunkBlocks: () => BlockInterface[]
}

class Terrian implements TerrianInterface {
  private simplex: SimplexNoise
  public chunks: ChunkInterface[] = []

  constructor() {
    this.simplex = new SimplexNoise(Math.random())
  }

  public generate(): void {
    this.chunks.push(new Chunk(this.simplex, 0, 0))
    this.chunks.push(new Chunk(this.simplex, -TERRIAN.CHUNK_SIZE, 0))
    this.chunks.push(new Chunk(this.simplex, 0, -TERRIAN.CHUNK_SIZE))
    this.chunks.push(new Chunk(this.simplex, -TERRIAN.CHUNK_SIZE, -TERRIAN.CHUNK_SIZE))
  }

  public getChunkBlocks(): BlockInterface[] {
    return this.chunks.map((chunk) => chunk.blocks).flat()
  }
}

export { Terrian, TerrianInterface }
