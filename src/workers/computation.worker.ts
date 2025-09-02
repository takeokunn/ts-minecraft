import { Effect, Option, pipe, Runtime } from 'effect'
import { match } from 'ts-pattern'
import Alea from 'alea'
import { createNoise2D } from 'simplex-noise'
import { BlockType, FaceName, getUvForFace, isBlockTransparent, PlacedBlock, TILE_SIZE } from '../domain/block'
import { ChunkGenerationResult, ComputationTask, GenerationParams } from '../domain/types'
import { CHUNK_HEIGHT, CHUNK_SIZE, WATER_LEVEL, WORLD_DEPTH, Y_OFFSET } from '../domain/world-constants'

type Noise2D = ReturnType<typeof createNoise2D>

// --- Error Types ---
class GreedyMeshError extends Error {
  readonly _tag = 'GreedyMeshError'
}

// --- Noise Generation ---

type NoiseFunctions = {
  readonly terrain: Noise2D
  readonly biome: Noise2D
  readonly trees: Noise2D
}

const createNoiseFunctions = (seeds: GenerationParams['seeds']): NoiseFunctions => {
  const createNoise = (seed: number) => createNoise2D(Alea(seed))
  return {
    terrain: createNoise(seeds.world),
    biome: createNoise(seeds.biome),
    trees: createNoise(seeds.trees),
  }
}

// --- Terrain Generation ---

const getTerrainHeight = (x: number, z: number, terrainNoise: Noise2D, amplitude: number) => {
  const frequency = 0.01
  return Math.floor(terrainNoise(x * frequency, z * frequency) * amplitude)
}

const getBiome = (x: number, z: number, biomeNoise: Noise2D) => {
  const frequency = 0.005
  return biomeNoise(x * frequency, z * frequency) > 0 ? 'desert' : 'plains'
}

const generateTerrainColumn = (chunkX: number, chunkZ: number, localX: number, localZ: number, noise: NoiseFunctions, amplitude: number): PlacedBlock[] => {
  const blocks: PlacedBlock[] = []
  const worldX = chunkX * CHUNK_SIZE + localX
  const worldZ = chunkZ * CHUNK_SIZE + localZ

  const height = getTerrainHeight(worldX, worldZ, noise.terrain, amplitude)
  const biome = getBiome(worldX, worldZ, noise.biome)

  for (let y = -WORLD_DEPTH; y < height; y++) {
    const worldY = y
    let blockType: BlockType = 'stone'
    if (y === height - 1) {
      blockType = biome === 'desert' ? 'sand' : 'grass'
    } else if (y > height - 4) {
      blockType = biome === 'desert' ? 'sand' : 'dirt'
    }
    blocks.push({ position: { x: localX, y: worldY, z: localZ }, blockType })
  }

  if (height < WATER_LEVEL) {
    for (let y = height; y < WATER_LEVEL; y++) {
      blocks.push({ position: { x: localX, y, z: localZ }, blockType: 'water' })
    }
  }

  const treeNoise = noise.trees(worldX, worldZ)
  if (biome === 'plains' && height >= WATER_LEVEL && treeNoise > 0.95) {
    const treeHeight = 4 + Math.floor(Math.abs(treeNoise) * 3)
    for (let i = 0; i < treeHeight; i++) {
      blocks.push({ position: { x: localX, y: height + i, z: localZ }, blockType: 'oakLog' })
    }
    for (let y = height + treeHeight - 2; y < height + treeHeight + 1; y++) {
      for (let x = -2; x <= 2; x++) {
        for (let z = -2; z <= 2; z++) {
          if (x !== 0 || z !== 0) {
            blocks.push({ position: { x: localX + x, y, z: localZ + z }, blockType: 'oakLeaves' })
          }
        }
      }
    }
  }

  return blocks
}

const generateBlockData = (params: GenerationParams): Effect.Effect<PlacedBlock[]> =>
  Effect.sync(() => {
    const { chunkX, chunkZ, seeds, amplitude, editedBlocks } = params
    const noise = createNoiseFunctions(seeds)
    const blocksMap = new Map<string, PlacedBlock>()

    for (let x = 0; x < CHUNK_SIZE; x++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const column = generateTerrainColumn(chunkX, chunkZ, x, z, noise, amplitude)
        for (const block of column) {
          const key = `${block.position.x},${block.position.y},${block.position.z}`
          blocksMap.set(key, block)
        }
      }
    }

    editedBlocks.destroyed.forEach((key) => blocksMap.delete(key))
    Object.entries(editedBlocks.placed).forEach(([key, block]) => {
      blocksMap.set(key, block)
    })

    return Array.from(blocksMap.values())
  })

// --- Greedy Meshing ---

type ChunkView = (BlockType | undefined)[][][]

const createChunkDataView = (blocks: ReadonlyArray<PlacedBlock>, startX: number, startZ: number): ChunkView => {
  const view: ChunkView = Array.from({ length: CHUNK_SIZE }, () => Array.from({ length: CHUNK_HEIGHT }, () => Array.from({ length: CHUNK_SIZE })))
  for (const { position, blockType } of blocks) {
    const localX = position.x - startX
    const localZ = position.z - startZ
    const yIndex = position.y + Y_OFFSET
    if (localX >= 0 && localX < CHUNK_SIZE && localZ >= 0 && localZ < CHUNK_SIZE && yIndex >= 0 && yIndex < CHUNK_HEIGHT) {
      const x = view[localX]
      if (x) {
        const y = x[yIndex]
        if (y) {
          y[localZ] = blockType
        }
      }
    }
  }
  return view
}

const getBlock = (view: ChunkView, x: number, y: number, z: number): Option.Option<BlockType> => {
  if (x < 0 || x >= CHUNK_SIZE || y < 0 || y >= CHUNK_HEIGHT || z < 0 || z >= CHUNK_SIZE) {
    return Option.none()
  }
  return Option.fromNullable(view[x]?.[y]?.[z])
}

const generateGreedyMesh = (blocks: ReadonlyArray<PlacedBlock>, chunkX: number, chunkZ: number): Effect.Effect<ChunkGenerationResult['mesh'], GreedyMeshError> =>
  Effect.try({
    try: () => {
      const startX = chunkX * CHUNK_SIZE
      const startZ = chunkZ * CHUNK_SIZE
      const chunkView = createChunkDataView(blocks, startX, startZ)

      const positions: number[] = []
      const normals: number[] = []
      const uvs: number[] = []
      const indices: number[] = []
      let vertexIndex = 0

      const dims: [number, number, number] = [CHUNK_SIZE, CHUNK_HEIGHT, CHUNK_SIZE]
      const pos: [number, number, number] = [0, 0, 0]

      for (let d = 0; d < 3; d++) {
        const d_ = d as 0 | 1 | 2
        for (pos[d_] = -1; pos[d_] < dims[d_]; pos[d_]++) {
          const u = (d_ + 1) % 3
          const v = (d_ + 2) % 3
          const dir: [number, number, number] = [0, 0, 0]
          for (let s = -1; s <= 1; s += 2) {
            dir[d_] = s
            const mask = Array.from({ length: dims[u] * dims[v] }, (): BlockType | null => null)
            let maskIdx = 0

            for (pos[v] = 0; pos[v] < dims[v]; ++pos[v]) {
              for (pos[u] = 0; pos[u] < dims[u]; ++pos[u]) {
                const b1 = getBlock(chunkView, pos[0], pos[1], pos[2])
                const b2 = getBlock(chunkView, pos[0] + (d_ === 0 ? s : 0), pos[1] + (d_ === 1 ? s : 0), pos[2] + (d_ === 2 ? s : 0))
                const t1 = pipe(
                  b1,
                  Option.map(isBlockTransparent),
                  Option.map((b) => !b),
                  Option.getOrElse(() => false),
                )
                const t2 = pipe(
                  b2,
                  Option.map(isBlockTransparent),
                  Option.map((b) => !b),
                  Option.getOrElse(() => false),
                )

                mask[maskIdx++] = t1 === t2 ? null : t1 ? Option.getOrNull(b1) : Option.getOrNull(b2)
              }
            }

            maskIdx = 0
            for (let j = 0; j < dims[v]; j++) {
              for (let i = 0; i < dims[u]; ) {
                const blockType = mask[maskIdx]
                if (blockType) {
                  let w = 1
                  while (i + w < dims[u] && mask[maskIdx + w] === blockType) w++
                  let h = 1
                  let done = false
                  while (j + h < dims[v]) {
                    for (let k = 0; k < w; k++) {
                      if (mask[maskIdx + k + h * dims[u]] !== blockType) {
                        done = true
                        break
                      }
                    }
                    if (done) break
                    h++
                  }

                  pos[u] = i
                  pos[v] = j
                  const du: [number, number, number] = [0, 0, 0]
                  du[u] = w
                  const dv: [number, number, number] = [0, 0, 0]
                  dv[v] = h

                  const faceName: FaceName = match(d_)
                    .with(0, () => (s > 0 ? 'east' : 'west'))
                    .with(1, () => (s > 0 ? 'top' : 'bottom'))
                    .with(2, () => (s > 0 ? 'north' : 'south'))
                    .exhaustive()
                  const tileUv = getUvForFace(blockType, faceName)

                  positions.push(
                    pos[0] + startX,
                    pos[1] - Y_OFFSET,
                    pos[2] + startZ,
                    pos[0] + du[0] + startX,
                    pos[1] + du[1] - Y_OFFSET,
                    pos[2] + du[2] + startZ,
                    pos[0] + du[0] + dv[0] + startX,
                    pos[1] + du[1] + dv[1] - Y_OFFSET,
                    pos[2] + du[2] + dv[2] + startZ,
                    pos[0] + dv[0] + startX,
                    pos[1] + dv[1] - Y_OFFSET,
                    pos[2] + dv[2] + startZ,
                  )
                  normals.push(dir[0], dir[1], dir[2], dir[0], dir[1], dir[2], dir[0], dir[1], dir[2], dir[0], dir[1], dir[2])

                  const u0 = tileUv[0] * TILE_SIZE
                  const v0 = 1.0 - tileUv[1] * TILE_SIZE
                  const u1 = (tileUv[0] + w) * TILE_SIZE
                  const v1 = 1.0 - (tileUv[1] + h) * TILE_SIZE
                  uvs.push(u0, v1, u1, v1, u1, v0, u0, v0)

                  indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2, vertexIndex, vertexIndex + 2, vertexIndex + 3)
                  vertexIndex += 4

                  for (let l = 0; l < h; l++) {
                    for (let k = 0; k < w; k++) {
                      mask[maskIdx + k + l * dims[u]] = null
                    }
                  }
                  i += w
                  maskIdx += w
                } else {
                  i++
                  maskIdx++
                }
              }
            }
          }
        }
      }
      return {
        positions: new Float32Array(positions),
        normals: new Float32Array(normals),
        uvs: new Float32Array(uvs),
        indices: new Uint32Array(indices),
      }
    },
    catch: (e) => {
      console.error(e)
      return new GreedyMeshError()
    },
  })

// --- Main Worker Logic ---

const generateChunk = (params: GenerationParams): Effect.Effect<ChunkGenerationResult, GreedyMeshError> =>
  Effect.gen(function* ($) {
    const blocks = yield* $(generateBlockData(params))
    const mesh = yield* $(generateGreedyMesh(blocks, params.chunkX, params.chunkZ))
    return {
      blocks,
      mesh,
      chunkX: params.chunkX,
      chunkZ: params.chunkZ,
    }
  })

const messageHandler = (e: MessageEvent<ComputationTask>) => {
  const program = match(e.data)
    .with({ type: 'generateChunk' }, (task) => generateChunk(task.payload))
    .exhaustive()

  const handleSuccess = (result: ChunkGenerationResult) => {
    const transferables = [result.mesh.positions.buffer, result.mesh.normals.buffer, result.mesh.uvs.buffer, result.mesh.indices.buffer]
    self.postMessage(result, { transfer: transferables })
  }

  const handleFailure = (error: unknown) => {
    console.error('Error in computation worker:', error)
    // Optionally, post an error message back to the main thread
    // self.postMessage({ type: 'error', error });
  }

  Effect.runPromise(program).then(handleSuccess).catch(handleFailure)
}

// Ensure we are in a worker context before assigning to self.onmessage
if (typeof self !== 'undefined' && 'onmessage' in self) {
  self.onmessage = messageHandler
}