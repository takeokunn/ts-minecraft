import { match } from 'ts-pattern'
import { createNoise2D, NoiseFunction2D } from 'simplex-noise'

import { Chunk } from '@src/chunk'
import { Block } from '@src/blocks'
import { BLOCK, TERRIAN } from '@src/constant'

/**
 * [1] [2] [3]
 * [4] [0] [5]
 * [6] [7] [8]
 */
const Position = {
  TopLeft: 1,
  TopCenter: 2,
  TopRight: 3,
  CenterLeft: 4,
  CenterRight: 5,
  BottomLeft: 6,
  BottomCenter: 7,
  BottomRight: 8,
} as const

type PositionType = (typeof Position)[keyof typeof Position]

interface TerrianInterface {
  chunks: Chunk[]
  getChunkBlocks: () => Block[]
  initialize: () => void
  generateNewChunk: (positionX: number, positionZ: number) => void
}

class Terrian implements TerrianInterface {
  private noise2D: NoiseFunction2D
  public chunks: Chunk[] = []

  constructor() {
    this.noise2D = createNoise2D()
  }

  public initialize(): void {
    const chunk = new Chunk(this.noise2D, -TERRIAN.CHUNK_SIZE / 2, -TERRIAN.CHUNK_SIZE / 2)
    this.chunks.push(chunk)
    Object.values(Position).forEach((pos) => this.generate(chunk, pos))
  }

  public getChunkBlocks(): Block[] {
    return this.chunks.map((chunk) => chunk.blocks).flat()
  }

  public generateNewChunk(positionX: number, positionZ: number): void {
    const chunk = this.detectCurrentChunkByPosition(positionX / BLOCK.SIZE, positionZ / BLOCK.SIZE)

    Object.values(Position)
      .forEach((pos) => {
        if (!this.hasNeighborhood(chunk, pos)) {
          this.generate(chunk, pos)
        }
      })
  }

  private detectCurrentChunkByPosition(positionX: number, positionZ: number): Chunk {
    return this.chunks.find((chunk: Chunk) => chunk.x1 <= positionX && positionX <= chunk.x2 && chunk.z1 <= positionZ && positionZ <= chunk.z2) as Chunk
  }

  private hasNeighborhood(centerChunk: Chunk, position: PositionType): boolean {
    return match<PositionType, boolean>(position)
      .with(Position.TopLeft, () => this.chunks.some((chunk: Chunk) => chunk.x1 === centerChunk.x1 - TERRIAN.CHUNK_SIZE && chunk.z1 === centerChunk.z2))
      .with(Position.TopCenter, () => this.chunks.some((chunk: Chunk) => chunk.x1 === centerChunk.x1 && chunk.z1 === centerChunk.z2))
      .with(Position.TopRight, () => this.chunks.some((chunk: Chunk) => chunk.x1 === centerChunk.x2 && chunk.z1 === centerChunk.z2))
      .with(Position.CenterLeft, () => this.chunks.some((chunk: Chunk) => chunk.x1 === centerChunk.x1 - TERRIAN.CHUNK_SIZE && chunk.z1 === centerChunk.z1))
      .with(Position.CenterRight, () => this.chunks.some((chunk: Chunk) => chunk.x1 === centerChunk.x2 && chunk.z1 === centerChunk.z1))
      .with(Position.BottomLeft, () => this.chunks.some((chunk: Chunk) => chunk.x1 === centerChunk.x1 - TERRIAN.CHUNK_SIZE && chunk.z1 === centerChunk.z1 - TERRIAN.CHUNK_SIZE))
      .with(Position.BottomCenter, () => this.chunks.some((chunk: Chunk) => chunk.x1 === centerChunk.x1 && chunk.z1 === centerChunk.z1 - TERRIAN.CHUNK_SIZE))
      .with(Position.BottomRight, () => this.chunks.some((chunk: Chunk) => chunk.x1 === centerChunk.x2 && chunk.z1 === centerChunk.z1 - TERRIAN.CHUNK_SIZE))
      .exhaustive()
  }

  private generate(centerChunk: Chunk, position: PositionType): Chunk {
    const chunk = match<PositionType, Chunk>(position)
      .with(Position.TopLeft, () => new Chunk(this.noise2D, centerChunk.x1 - TERRIAN.CHUNK_SIZE, centerChunk.z2))
      .with(Position.TopCenter, () => new Chunk(this.noise2D, centerChunk.x1, centerChunk.z2))
      .with(Position.TopRight, () => new Chunk(this.noise2D, centerChunk.x2, centerChunk.z2))
      .with(Position.CenterLeft, () => new Chunk(this.noise2D, centerChunk.x1 - TERRIAN.CHUNK_SIZE, centerChunk.z1))
      .with(Position.CenterRight, () => new Chunk(this.noise2D, centerChunk.x2, centerChunk.z1))
      .with(Position.BottomLeft, () => new Chunk(this.noise2D, centerChunk.x1 - TERRIAN.CHUNK_SIZE, centerChunk.z1 - TERRIAN.CHUNK_SIZE))
      .with(Position.BottomCenter, () => new Chunk(this.noise2D, centerChunk.x1, centerChunk.z1 - TERRIAN.CHUNK_SIZE))
      .with(Position.BottomRight, () => new Chunk(this.noise2D, centerChunk.x2, centerChunk.z1 - TERRIAN.CHUNK_SIZE))
      .exhaustive()

    this.chunks.push(chunk)

    return chunk
  }
}

export { Terrian }
