import { Data } from 'effect'
import type { ChunkCoord } from '@ts-minecraft/kernel'

export class ChunkError extends Data.TaggedError('ChunkError')<{
  readonly chunkCoord: ChunkCoord
  readonly reason: string
  readonly localPosition?: readonly [number, number, number]
}> {
  override get message(): string {
    const localPosStr = this.localPosition
      ? ` at local (${this.localPosition[0]}, ${this.localPosition[1]}, ${this.localPosition[2]})`
      : ''
    return `Chunk error at (${this.chunkCoord.x}, ${this.chunkCoord.z})${localPosStr}: ${this.reason}`
  }
}
