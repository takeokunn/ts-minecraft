import { Vector3 } from 'three'
import { v4 as uuidv4 } from 'uuid'
import { NoiseFunction2D } from 'simplex-noise'

import { Dart, Grass, Block } from '@src/blocks'
import { BLOCK, TERRIAN } from '@src/constant'

interface ChunkInterface {
  id: string
  x1: number
  x2: number
  z1: number
  z2: number
  blocks: Block[]
}

class Chunk implements ChunkInterface {
  public id: string
  public x1: number
  public x2: number
  public z1: number
  public z2: number
  public blocks: Block[] = []

  constructor(noise2D: NoiseFunction2D, baseX: number, baseZ: number) {
    this.id = uuidv4()
    this.x1 = baseX
    this.x2 = baseX + TERRIAN.CHUNK_SIZE
    this.z1 = baseZ
    this.z2 = baseZ + TERRIAN.CHUNK_SIZE

    for (let x = 0; x < TERRIAN.CHUNK_SIZE; x++) {
      for (let z = 0; z < TERRIAN.CHUNK_SIZE; z++) {
        const positionX = baseX + x
        const positionZ = baseZ + z
        const xoff = TERRIAN.INCREMENT_OFFSET * positionX
        const zoff = TERRIAN.INCREMENT_OFFSET * positionZ
        const y = Math.round((noise2D(xoff, zoff) * TERRIAN.AMPLITUDE) / BLOCK.SIZE)
        this.blocks.push(new Grass(new Vector3(positionX * BLOCK.SIZE, y * BLOCK.SIZE, positionZ * BLOCK.SIZE), true))
        this.blocks.push(new Dart(new Vector3(positionX * BLOCK.SIZE, (y - 1) * BLOCK.SIZE, positionZ * BLOCK.SIZE), false))
      }
    }
  }
}

export { Chunk }
