import { Effect } from 'effect'
import * as THREE from 'three'
import { Chunk, CHUNK_SIZE } from '@/domain/chunk'
import { TextureError } from '@/domain'
import { ATLAS_COLS, ATLAS_SIZE } from '../textures/block-texture-map'
import { greedyMeshChunk, MeshedChunk } from './greedy-meshing'

const TILE_PX = ATLAS_SIZE / ATLAS_COLS  // 16

const buildGeometry = (meshed: MeshedChunk): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(meshed.positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(meshed.normals, 3))
  geometry.setAttribute('color', new THREE.BufferAttribute(meshed.colors, 3))
  geometry.setAttribute('uv', new THREE.BufferAttribute(meshed.uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(meshed.indices, 1))
  return geometry
}

const buildAtlasTexture = (): Effect.Effect<THREE.Texture, TextureError> =>
  Effect.tryPromise({
    try: async () => {
      const canvas = document.createElement('canvas')
      canvas.width = ATLAS_SIZE
      canvas.height = ATLAS_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('Failed to acquire 2D canvas context for atlas build')
      }

      const drawImageTile = (url: string, tileIndex: number): Promise<void> => {
        const img = new Image()
        return new Promise<void>((resolve) => {
          img.onload = () => {
            const col = tileIndex % ATLAS_COLS
            const row = Math.floor(tileIndex / ATLAS_COLS)
            ctx.drawImage(img, col * TILE_PX, row * TILE_PX, TILE_PX, TILE_PX)
            resolve()
          }
          img.onerror = (e) => {
            // Use Effect.runFork to route the warning through Effect's logging infrastructure
            Effect.runFork(Effect.logWarning(`Failed to load texture: ${url} — ${String(e)}`))
            resolve()
          }
          img.src = url
        })
      }

      const drawProceduralTile = (
        tileIndex: number,
        drawFn: (context: CanvasRenderingContext2D, x: number, y: number) => void
      ): void => {
        const col = tileIndex % ATLAS_COLS
        const row = Math.floor(tileIndex / ATLAS_COLS)
        drawFn(ctx, col * TILE_PX, row * TILE_PX)
      }

      // Load existing texture files in parallel
      await Promise.all([
        drawImageTile('/textures/dirt.png', 0),
        drawImageTile('/textures/stone.png', 1),
        drawImageTile('/textures/wood.png', 2),   // wood side (bark)
        drawImageTile('/textures/grass.png', 4),  // grass top
        drawImageTile('/textures/sand.png', 6),
      ])

      // Generate procedural tiles for missing textures
      drawProceduralTile(3, (context, x, y) => {
        // wood_top: brown with concentric rings
        context.fillStyle = '#7a5c1e'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        context.strokeStyle = '#5c4414'
        context.lineWidth = 1
        for (let r = 2; r < 8; r += 2) {
          context.beginPath()
          context.arc(x + 8, y + 8, r, 0, Math.PI * 2)
          context.stroke()
        }
      })

      drawProceduralTile(5, (context, x, y) => {
        // grass_side: brown with green top stripe
        context.fillStyle = '#8B4513'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        context.fillStyle = '#3a8a3a'
        context.fillRect(x, y, TILE_PX, 4)
      })

      drawProceduralTile(7, (context, x, y) => {
        // water: blue with horizontal wave lines
        context.fillStyle = '#1a44bb'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        context.fillStyle = '#2255cc'
        for (let wy = 0; wy < TILE_PX; wy += 4) {
          context.fillRect(x, y + wy, TILE_PX, 2)
        }
      })

      drawProceduralTile(8, (context, x, y) => {
        // leaves: dark green with lighter spots
        context.fillStyle = '#1a7a1a'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        context.fillStyle = '#228b22'
        for (let lx = 0; lx < TILE_PX; lx += 3) {
          for (let ly = 0; ly < TILE_PX; ly += 3) {
            if ((lx + ly) % 6 === 0) context.fillRect(x + lx, y + ly, 2, 2)
          }
        }
      })

      drawProceduralTile(9, (context, x, y) => {
        // glass: light blue with border highlight
        context.fillStyle = '#aaddff'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        context.fillStyle = '#cceeff'
        context.fillRect(x + 1, y + 1, TILE_PX - 2, 1)
        context.fillRect(x + 1, y + 1, 1, TILE_PX - 2)
      })

      drawProceduralTile(10, (context, x, y) => {
        // snow: near-white with subtle blue tint
        context.fillStyle = '#f0f5ff'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        context.fillStyle = '#e0eaff'
        for (let sx = 0; sx < TILE_PX; sx += 4) {
          context.fillRect(x + sx, y + (sx % 8), 1, 1)
        }
      })

      drawProceduralTile(11, (context, x, y) => {
        // gravel: grey-brown with speckles
        context.fillStyle = '#7a6a5a'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        const speckles: ReadonlyArray<readonly [number, number]> = [
          [1, 2], [4, 5], [7, 1], [10, 8], [13, 4], [3, 11], [8, 13], [12, 10],
        ]
        for (const [sx, sy] of speckles) {
          context.fillStyle = sx % 2 === 0 ? '#8a7a6a' : '#6a5a4a'
          context.fillRect(x + sx, y + sy, 2, 2)
        }
      })

      drawProceduralTile(12, (context, x, y) => {
        // cobblestone: grey with darker patches
        context.fillStyle = '#808080'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        const patches: ReadonlyArray<readonly [number, number, number, number]> = [
          [0, 0, 5, 4], [6, 0, 5, 4], [12, 0, 4, 4],
          [0, 5, 4, 5], [5, 5, 6, 5], [12, 5, 4, 5],
          [0, 11, 6, 5], [7, 11, 5, 5],
        ]
        for (const [px, py, pw, ph] of patches) {
          context.fillStyle = '#686868'
          context.fillRect(x + px, y + py, pw, ph)
          context.strokeStyle = '#505050'
          context.lineWidth = 0.5
          context.strokeRect(x + px + 0.5, y + py + 0.5, pw - 1, ph - 1)
        }
      })

      const texture = new THREE.CanvasTexture(canvas)
      texture.magFilter = THREE.NearestFilter
      texture.minFilter = THREE.NearestFilter
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      return texture
    },
    catch: (cause) => new TextureError({ url: '/textures/atlas', cause }),
  })

export class ChunkMeshService extends Effect.Service<ChunkMeshService>()(
  '@minecraft/infrastructure/ChunkMeshService',
  {
    effect: Effect.gen(function* () {
      const atlasTexture = yield* Effect.orDie(buildAtlasTexture())

      const sharedMaterial = new THREE.MeshStandardMaterial({
        map: atlasTexture,
        vertexColors: true,
        roughness: 0.8,
        metalness: 0,
      })

      return {
        createChunkMesh: (chunk: Chunk): Effect.Effect<THREE.Mesh, never> =>
          Effect.sync(() => {
            const meshed = greedyMeshChunk(chunk, {
              wx: chunk.coord.x * CHUNK_SIZE,
              wz: chunk.coord.z * CHUNK_SIZE,
            })
            const geometry = buildGeometry(meshed)
            const mesh = new THREE.Mesh(geometry, sharedMaterial)
            mesh.userData['blockPositions'] = meshed.blockPositions
            mesh.userData['chunkCoord'] = chunk.coord
            return mesh
          }),

        updateChunkMesh: (mesh: THREE.Mesh, chunk: Chunk): Effect.Effect<void, never> =>
          Effect.sync(() => {
            const oldGeometry = mesh.geometry
            const meshed = greedyMeshChunk(chunk, {
              wx: chunk.coord.x * CHUNK_SIZE,
              wz: chunk.coord.z * CHUNK_SIZE,
            })
            mesh.geometry = buildGeometry(meshed)
            mesh.userData['blockPositions'] = meshed.blockPositions
            mesh.userData['chunkCoord'] = chunk.coord
            oldGeometry.dispose()
          }),

        disposeMesh: (mesh: THREE.Mesh): Effect.Effect<void, never> =>
          Effect.sync(() => {
            mesh.geometry.dispose()
          }),
      }
    }),
  }
) {}
export const ChunkMeshServiceLive = ChunkMeshService.Default
