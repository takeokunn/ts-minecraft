import { createNoise2D, NoiseFunction2D } from 'simplex-noise'

import { Chunk } from '@src/chunk'
import { Block } from '@src/blocks'
import { TERRIAN } from '@src/constant'

enum Position {
  TopLeft = 1,
  TopCenter = 2,
  TopRight = 3,
  CenterLeft = 4,
  Center = 0,
  CenterRight = 5,
  BottomLeft = 6,
  BottomCenter = 7,
  BottomRight = 8,
}

interface TerrianInterface {
  chunks: Chunk[]
  getChunkBlocks: () => Block[]
  initialize: () => void
  generateNewChunk: (positionX: number, positionZ: number) => void
}

/**
 * generate initalize
 *
 * [1] [2] [3]
 * [4] [0] [5]
 * [6] [7] [8]
 */
class Terrian implements TerrianInterface {
  private noise2D: NoiseFunction2D
  public chunks: Chunk[] = []

  constructor() {
    this.noise2D = createNoise2D()
  }

  public initialize(): void {
    const chunk = new Chunk(this.noise2D, -TERRIAN.CHUNK_SIZE / 2, -TERRIAN.CHUNK_SIZE / 2)
    this.chunks.push(chunk) // [0]
    this.generate(chunk, Position.TopLeft) // [1]
    this.generate(chunk, Position.TopCenter) // [2]
    this.generate(chunk, Position.TopRight) // [3]
    this.generate(chunk, Position.CenterLeft) // [4]
    this.generate(chunk, Position.CenterRight) // [5]
    this.generate(chunk, Position.BottomLeft) // [6]
    this.generate(chunk, Position.BottomCenter) // [7]
    this.generate(chunk, Position.BottomRight) // [8]
  }

  public getChunkBlocks(): Block[] {
    return this.chunks.map((chunk) => chunk.blocks).flat()
  }

  public generateNewChunk(positionX: number, positionZ: number): void {
    const chunk = this.detectCurrentChunkByPosition(positionX, positionZ)
    if (!chunk) return

    if (!this.hasNeighborhood(chunk, Position.TopLeft)) this.generate(chunk, Position.TopLeft)
    if (!this.hasNeighborhood(chunk, Position.TopCenter)) this.generate(chunk, Position.TopCenter)
    if (!this.hasNeighborhood(chunk, Position.TopRight)) this.generate(chunk, Position.TopRight)
    if (!this.hasNeighborhood(chunk, Position.CenterLeft)) this.generate(chunk, Position.CenterLeft)
    if (!this.hasNeighborhood(chunk, Position.CenterRight)) this.generate(chunk, Position.CenterRight)
    if (!this.hasNeighborhood(chunk, Position.BottomLeft)) this.generate(chunk, Position.BottomLeft)
    if (!this.hasNeighborhood(chunk, Position.BottomCenter)) this.generate(chunk, Position.BottomCenter)
    if (!this.hasNeighborhood(chunk, Position.BottomRight)) this.generate(chunk, Position.BottomRight)
  }

  private detectCurrentChunkByPosition(positionX: number, positionZ: number): Chunk | undefined {
    return this.chunks.find((chunk: Chunk) => chunk.x1 <= positionX && positionX <= chunk.x2 && chunk.z1 <= positionZ && positionZ <= chunk.z2)
  }

  private hasNeighborhood(centerChunk: Chunk, position: Position): boolean {
    switch (position) {
      case Position.TopLeft:
        return this.chunks.some((chunk: Chunk) => chunk.x1 === centerChunk.x1 - TERRIAN.CHUNK_SIZE && chunk.z1 === centerChunk.z2)
      case Position.TopCenter:
        return this.chunks.some((chunk: Chunk) => chunk.x1 === centerChunk.x1 && chunk.z1 === centerChunk.z2)
      case Position.TopRight:
        return this.chunks.some((chunk: Chunk) => chunk.x1 === centerChunk.x2 && chunk.z1 === centerChunk.z2)
      case Position.CenterLeft:
        return this.chunks.some((chunk: Chunk) => chunk.x1 === centerChunk.x1 - TERRIAN.CHUNK_SIZE && chunk.z1 === centerChunk.z1)
      case Position.CenterRight:
        return this.chunks.some((chunk: Chunk) => chunk.x1 === centerChunk.x2 && chunk.z1 === centerChunk.z1)
      case Position.BottomLeft:
        return this.chunks.some((chunk: Chunk) => chunk.x1 === centerChunk.x1 - TERRIAN.CHUNK_SIZE && chunk.z1 === centerChunk.z1 - TERRIAN.CHUNK_SIZE)
      case Position.BottomCenter:
        return this.chunks.some((chunk: Chunk) => chunk.x1 === centerChunk.x1 && chunk.z1 === centerChunk.z1 - TERRIAN.CHUNK_SIZE)
      case Position.BottomRight:
        return this.chunks.some((chunk: Chunk) => chunk.x1 === centerChunk.x2 && chunk.z1 === centerChunk.z1 - TERRIAN.CHUNK_SIZE)
    }
    return true
  }

  private generate(centerChunk: Chunk, position: Position): void {
    switch (position) {
      case Position.TopLeft:
        this.chunks.push(new Chunk(this.noise2D, centerChunk.x1 - TERRIAN.CHUNK_SIZE, centerChunk.z2))
        break
      case Position.TopCenter:
        this.chunks.push(new Chunk(this.noise2D, centerChunk.x1, centerChunk.z2))
        break
      case Position.TopRight:
        this.chunks.push(new Chunk(this.noise2D, centerChunk.x2, centerChunk.z2))
        break
      case Position.CenterLeft:
        this.chunks.push(new Chunk(this.noise2D, centerChunk.x1 - TERRIAN.CHUNK_SIZE, centerChunk.z1))
        break
      case Position.CenterRight:
        this.chunks.push(new Chunk(this.noise2D, centerChunk.x2, centerChunk.z1))
        break
      case Position.BottomLeft:
        this.chunks.push(new Chunk(this.noise2D, centerChunk.x1 - TERRIAN.CHUNK_SIZE, centerChunk.z1 - TERRIAN.CHUNK_SIZE))
        break
      case Position.BottomCenter:
        this.chunks.push(new Chunk(this.noise2D, centerChunk.x1, centerChunk.z1 - TERRIAN.CHUNK_SIZE))
        break
      case Position.BottomRight:
        this.chunks.push(new Chunk(this.noise2D, centerChunk.x2, centerChunk.z1 - TERRIAN.CHUNK_SIZE))
        break
    }
  }
}

export { Terrian }
