import { match, P } from 'ts-pattern'
import { BlockType, FaceName, getUvForFace, isBlockTransparent, PlacedBlock, TILE_SIZE } from '../domain/block'
import { ChunkGenerationResult, ComputationTask, GenerationParams } from '../domain/types'
import { CHUNK_HEIGHT, CHUNK_SIZE, MIN_WORLD_Y, WATER_LEVEL, WORLD_DEPTH, Y_OFFSET } from '../domain/world-constants'
import { Option, pipe } from 'effect'
import { Alea } from 'alea'
import { createNoise2D, type Noise2D } from 'simplex-noise'
import { match, P } from 'ts-pattern'
import { BlockType, FaceName, getUvForFace, isBlockTransparent, PlacedBlock, TILE_SIZE } from '../domain/block'
import { ChunkGenerationResult, ComputationTask, GenerationParams } from '../domain/types'
import { CHUNK_HEIGHT, CHUNK_SIZE, MIN_WORLD_Y, WATER_LEVEL, WORLD_DEPTH, Y_OFFSET } from '../domain/world-constants'
import { Option, pipe } from 'effect'
import Alea from 'alea'
import { createNoise2D, type Noise2D } from 'simplex-noise'

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

const generateTerrainColumn = (
  chunkX: number,
  chunkZ: number,
  localX: number,
  localZ: number,
  noise: NoiseFunctions,
  amplitude: number,
): PlacedBlock[] => {
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

const generateBlockData = (params: GenerationParams): PlacedBlock[] => {
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
}

// --- Greedy Meshing ---

const generateGreedyMesh = (blocks: ReadonlyArray<PlacedBlock>, chunkX: number, chunkZ: number): ChunkGenerationResult['mesh'] => {
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
        const mask = Array.from({ length: dims[u]! * dims[v]! }, (): BlockType | null => null)
        let maskIdx = 0

        for (pos[v] = 0; pos[v] < dims[v]!; ++pos[v]) {
          for (pos[u] = 0; pos[u] < dims[u]!; ++pos[u]) {
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
        for (let j = 0; j < dims[v]!; j++) {
          for (let i = 0; i < dims[u]!; ) {
            if (mask[maskIdx]) {
              const blockType = mask[maskIdx]!
              let w = 1
              while (i + w < dims[u]! && mask[maskIdx + w] === blockType) w++
              let h = 1
              let done = false
              while (j + h < dims[v]!) {
                for (let k = 0; k < w; k++) {
                  if (mask[maskIdx + k + h * dims[u]!] !== blockType) {
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
              const v0 = 1.0 - (tileUv[1] + 1) * TILE_SIZE
              const u1 = (tileUv[0] + w) * TILE_SIZE
              const v1 = 1.0 - (tileUv[1] + h) * TILE_SIZE
              uvs.push(u0, v1, u1, v1, u1, v0, u0, v0)

              indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2, vertexIndex, vertexIndex + 2, vertexIndex + 3)
              vertexIndex += 4

              for (let l = 0; l < h; l++) {
                for (let k = 0; k < w; k++) {
                  mask[maskIdx + k + l * dims[u]!] = null
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
}

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

// --- Main Worker Logic ---

export const generateChunk = (params: GenerationParams): ChunkGenerationResult => {
  const blocks = generateBlockData(params)
  const mesh = generateGreedyMesh(blocks, params.chunkX, params.chunkZ)
  return {
    blocks,
    mesh,
    chunkX: params.chunkX,
    chunkZ: params.chunkZ,
  }
}

const messageHandler = (e: MessageEvent<ComputationTask>) => {
  try {
    match(e.data)
      .with({ type: 'generateChunk' }, (task) => {
        const result = generateChunk(task.payload)
        const transferables = [result.mesh.positions.buffer, result.mesh.normals.buffer, result.mesh.uvs.buffer, result.mesh.indices.buffer]
        self.postMessage(result, { transfer: transferables })
      })
      .exhaustive()
  } catch (error) {
    console.error('Error in computation worker:', error)
  }
}

// Ensure we are in a worker context before assigning to self.onmessage
if (typeof self !== 'undefined' && 'onmessage' in self) {
  self.onmessage = messageHandler
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

const generateTerrainColumn = (
  chunkX: number,
  chunkZ: number,
  localX: number,
  localZ: number,
  noise: NoiseFunctions,
  amplitude: number,
): PlacedBlock[] => {
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
    blocks.push(createPlacedBlock({ x: localX, y: worldY, z: localZ }, blockType))
  }

  if (height < WATER_LEVEL) {
    for (let y = height; y < WATER_LEVEL; y++) {
      blocks.push(createPlacedBlock({ x: localX, y, z: localZ }, 'water'))
    }
  }

  const treeNoise = noise.trees(worldX, worldZ)
  if (biome === 'plains' && height >= WATER_LEVEL && treeNoise > 0.95) {
    const treeHeight = 4 + Math.floor(Math.abs(treeNoise) * 3)
    for (let i = 0; i < treeHeight; i++) {
      blocks.push(createPlacedBlock({ x: localX, y: height + i, z: localZ }, 'oakLog'))
    }
    for (let y = height + treeHeight - 2; y < height + treeHeight + 1; y++) {
      for (let x = -2; x <= 2; x++) {
        for (let z = -2; z <= 2; z++) {
          if (x !== 0 || z !== 0) {
            blocks.push(createPlacedBlock({ x: localX + x, y, z: localZ + z }, 'oakLeaves'))
          }
        }
      }
    }
  }

  return blocks
}

const generateBlockData = (params: GenerationParams): PlacedBlock[] => {
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
    blocksMap.set(key, createPlacedBlock(block.position, block.blockType))
  })

  return Array.from(blocksMap.values())
}

// --- Greedy Meshing ---

type BlockVoxel = BlockType | 0

const getVoxel = (blocks: PlacedBlock[], x: number, y: number, z: number): BlockVoxel => {
  const block = blocks.find((b) => b.position.x === x && b.position.y === y && b.position.z === z)
  return block ? block.blockType : 0
}

const generateGreedyMesh = (blocks: PlacedBlock[]): ChunkMesh => {
  const vertices: number[] = []
  const normals: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let index = 0

  const voxels = new Map<string, BlockType>()
  for (const block of blocks) {
    voxels.set(`${block.position.x},${block.position.y},${block.position.z}`, block.blockType)
  }

  const visited = new Set<string>()

  for (const block of blocks) {
    const { x, y, z } = block.position
    const key = `${x},${y},${z}`
    if (visited.has(key)) {
      continue
    }

    const blockType = block.blockType
    if (isBlockTransparent(blockType)) {
      visited.add(key)
      continue
    }

    // For simplicity, this is a naive implementation and not a full greedy mesh.
    // It just creates faces for exposed sides of a block.
    // A true greedy meshing implementation would merge adjacent faces.

    const neighbors = [
      { face: [0, 1, 0], dir: [0, 1, 0] }, // top
      { face: [0, -1, 0], dir: [0, -1, 0] }, // bottom
      { face: [1, 0, 0], dir: [1, 0, 0] }, // right
      { face: [-1, 0, 0], dir: [-1, 0, 0] }, // left
      { face: [0, 0, 1], dir: [0, 0, 1] }, // front
      { face: [0, 0, -1], dir: [0, 0, -1] }, // back
    ]

    for (const { dir } of neighbors) {
      const nx = x + dir[0]
      const ny = y + dir[1]
      const nz = z + dir[2]
      const neighborKey = `${nx},${ny},${nz}`
      const neighborType = voxels.get(neighborKey)

      if (!neighborType || isBlockTransparent(neighborType)) {
        // This face is exposed, add it to the mesh
        const faceVertices = createFace(dir, { x, y, z })
        vertices.push(...faceVertices)
        normals.push(...Array(4).fill(dir).flat())
        // TODO: Add correct UVs based on block type and face
        uvs.push(0, 0, 1, 0, 0, 1, 1, 1)
        indices.push(index, index + 1, index + 2, index + 2, index + 1, index + 3)
        index += 4
      }
    }
    visited.add(key)
  }

  return {
    positions: new Float32Array(vertices),
    normals: new Float32Array(normals),
    uvs: new Float32Array(uvs),
    indices: new Uint32Array(indices),
  }
}

const createFace = (dir: number[], pos: { x: number; y: number; z: number }) => {
  const { x, y, z } = pos
  const w = 1,
    h = 1,
    d = 1
  switch (dir.join(',')) {
    case '0,1,0': // top
      return [x, y + h, z, x + w, y + h, z, x, y + h, z + d, x + w, y + h, z + d]
    case '0,-1,0': // bottom
      return [x, y, z + d, x + w, y, z + d, x, y, z, x + w, y, z]
    case '1,0,0': // right
      return [x + w, y, z, x + w, y + h, z, x + w, y, z + d, x + w, y + h, z + d]
    case '-1,0,0': // left
      return [x, y, z + d, x, y + h, z + d, x, y, z, x, y + h, z]
    case '0,0,1': // front
      return [x, y, z + d, x, y + h, z + d, x + w, y, z + d, x + w, y + h, z + d]
    case '0,0,-1': // back
      return [x + w, y, z, x + w, y + h, z, x, y, z, x, y + h, z]
    default:
      return []
  }
}

// --- Main Worker Logic ---

self.onmessage = (e: MessageEvent<any>) => {
  const { type, payload } = e.data
  if (type === 'generateChunk') {
    const blocks = generateBlockData(payload)
    const mesh = generateGreedyMesh(blocks)
    self.postMessage({
      type: 'chunkGenerated',
      payload: {
        blocks,
        mesh,
        chunkX: payload.chunkX,
        chunkZ: payload.chunkZ,
      },
    })
  }
}

export const generateChunk = (params: GenerationParams) => {
  const blocks = generateBlockData(params)
  const mesh = generateGreedyMesh(blocks)
  return {
    blocks,
    mesh,
    chunkX: params.chunkX,
    chunkZ: params.chunkZ,
  }
}


type ChunkMeshData = ChunkGenerationResult['mesh']

type NoiseFunctions = {
  readonly world: (x: number, z: number) => number
  readonly biome: (x: number, z: number) => number
  readonly trees: (x: number, z: number) => number
}

const createNoiseFunctions = (seeds: GenerationParams['seeds']): NoiseFunctions => {
  const createNoise = (seed: number) => (x: number, z: number) => {
    noise.seed(seed)
    return noise.perlin2(x, z)
  }
  return {
    world: createNoise(seeds.world),
    biome: createNoise(seeds.biome),
    trees: createNoise(seeds.trees),
  }
}

const getBlockTypeForDepth = (depth: number, biome: 'plains' | 'desert'): Option.Option<BlockType> => {
  return match<[number, 'plains' | 'desert'], Option.Option<BlockType>>([depth, biome])
    .with([0, 'plains'], () => Option.some('grass'))
    .with([0, 'desert'], () => Option.some('sand'))
    .with([P.when((d) => d <= 2), 'plains'], () => Option.some('dirt'))
    .with([P.when((d) => d <= 2), 'desert'], () => Option.some('sand'))
    .with([P.when((d) => d <= 4), P._], () => Option.some('stone'))
    .otherwise(() => Option.none())
}

const generateTerrainColumn = (x: number, z: number, noiseFuncs: NoiseFunctions, amplitude: number, destroyedBlocks: ReadonlySet<string>): ReadonlyArray<PlacedBlock> => {
  const columnBlocks: PlacedBlock[] = []
  const noiseIncrement = 0.05
  const xOff = noiseIncrement * x
  const zOff = noiseIncrement * z

  const terrainHeight = Math.round(noiseFuncs.world(xOff, zOff) * amplitude)
  const biome = noiseFuncs.biome(xOff, zOff) < 0.2 ? 'plains' : 'desert'

  for (let depth = 0; depth < WORLD_DEPTH; depth++) {
    const y = terrainHeight - depth
    if (y < MIN_WORLD_Y) continue
    const position = { x, y, z }
    if (destroyedBlocks.has(`${x},${y},${z}`)) continue

    pipe(
      getBlockTypeForDepth(depth, biome),
      Option.map((blockType) => {
        columnBlocks.push({ position, blockType })
      }),
    )
  }

  for (let y = terrainHeight + 1; y <= WATER_LEVEL; y++) {
    const position = { x, y, z }
    if (!destroyedBlocks.has(`${x},${y},${z}`)) {
      columnBlocks.push({ position, blockType: 'water' })
    }
  }

  return columnBlocks
}

const generateBlockData = (params: GenerationParams): ReadonlyArray<PlacedBlock> => {
  const { chunkX, chunkZ, seeds, amplitude, editedBlocks } = params
  const noiseFuncs = createNoiseFunctions(seeds)
  const startX = chunkX * CHUNK_SIZE
  const startZ = chunkZ * CHUNK_SIZE

  const placedInChunk = Object.values(editedBlocks.placed).filter((block) => {
    const { position } = block
    return position.x >= startX && position.x < startX + CHUNK_SIZE && position.z >= startZ && position.z < startZ + CHUNK_SIZE
  })

  const placedPositions = new Set(placedInChunk.map((b) => `${b.position.x},${b.position.y},${b.position.z}`))

  const terrainBlocks: PlacedBlock[] = []
  for (let x = startX; x < startX + CHUNK_SIZE; x++) {
    for (let z = startZ; z < startZ + CHUNK_SIZE; z++) {
      const column = generateTerrainColumn(x, z, noiseFuncs, amplitude, editedBlocks.destroyed)
      for (const block of column) {
        const key = `${block.position.x},${block.position.y},${block.position.z}`
        if (!placedPositions.has(key)) {
          terrainBlocks.push(block)
        }
      }
    }
  }

  return [...terrainBlocks, ...placedInChunk]
}

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

export const generateGreedyMesh = (blocks: ReadonlyArray<PlacedBlock>, chunkX: number, chunkZ: number): ChunkMeshData => {
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
        const mask = Array.from({ length: dims[u]! * dims[v]! }, (): BlockType | null => null)
        let maskIdx = 0

        for (pos[v] = 0; pos[v] < dims[v]!; ++pos[v]) {
          for (pos[u] = 0; pos[u] < dims[u]!; ++pos[u]) {
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
        for (let j = 0; j < dims[v]!; j++) {
          for (let i = 0; i < dims[u]!; ) {
            if (mask[maskIdx]) {
              const blockType = mask[maskIdx]!
              let w = 1
              while (i + w < dims[u]! && mask[maskIdx + w] === blockType) w++
              let h = 1
              let done = false
              while (j + h < dims[v]!) {
                for (let k = 0; k < w; k++) {
                  if (mask[maskIdx + k + h * dims[u]!] !== blockType) {
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
              const v0 = 1.0 - (tileUv[1] + 1) * TILE_SIZE
              const u1 = (tileUv[0] + w) * TILE_SIZE
              const v1 = 1.0 - (tileUv[1] + h) * TILE_SIZE
              uvs.push(u0, v1, u1, v1, u1, v0, u0, v0)

              indices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2, vertexIndex, vertexIndex + 2, vertexIndex + 3)
              vertexIndex += 4

              for (let l = 0; l < h; l++) {
                for (let k = 0; k < w; k++) {
                  mask[maskIdx + k + l * dims[u]!] = null
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
}

export const generateChunk = (params: GenerationParams): ChunkGenerationResult => {
  const blocks = generateBlockData(params)
  const mesh = generateGreedyMesh(blocks, params.chunkX, params.chunkZ)
  return {
    blocks,
    mesh,
    chunkX: params.chunkX,
    chunkZ: params.chunkZ,
  }
}

const messageHandler = (e: MessageEvent<ComputationTask>) => {
  try {
    match(e.data)
      .with({ type: 'generateChunk' }, (task) => {
        const result = generateChunk(task.payload)
        const transferables = [result.mesh.positions.buffer, result.mesh.normals.buffer, result.mesh.uvs.buffer, result.mesh.indices.buffer]
        self.postMessage(result, { transfer: transferables })
      })
      .exhaustive()
  } catch (error) {
    console.error('Error in computation worker:', error)
  }
}

// Ensure we are in a worker context before assigning to self.onmessage
if (typeof self !== 'undefined' && 'onmessage' in self) {
  self.onmessage = messageHandler
}
