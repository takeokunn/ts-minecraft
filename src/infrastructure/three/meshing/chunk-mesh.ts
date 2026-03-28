import { Array as Arr, Effect, Option } from 'effect'
import * as THREE from 'three'
import { Chunk, CHUNK_SIZE, blockTypeToIndex } from '@/domain/chunk'
import { TextureError } from '@/domain'
import { ATLAS_COLS, ATLAS_SIZE } from '../textures/block-texture-map'
import { greedyMeshChunk, MeshedChunk } from './greedy-meshing'

const TILE_PX = ATLAS_SIZE / ATLAS_COLS  // 32

const TRANSPARENT_BLOCK_IDS = new Set([blockTypeToIndex('WATER')])

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
        // This throw is inside Effect.tryPromise's async callback, so it is
        // caught by the `catch` handler and mapped to TextureError — not a defect.
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

      // tile 3: wood_top — brown with concentric rings (more rings for 32×32)
      drawProceduralTile(3, (context, x, y) => {
        context.fillStyle = '#7a5c1e'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        context.strokeStyle = '#5c4414'
        context.lineWidth = 1
        for (let r = 2; r < TILE_PX / 2 - 1; r += 3) {
          context.beginPath()
          context.arc(x + TILE_PX / 2, y + TILE_PX / 2, r, 0, Math.PI * 2)
          context.stroke()
        }
        // Center heartwood dot (fillRect avoids context.fill() which is unavailable in test env)
        context.fillStyle = '#4a3010'
        context.fillRect(x + TILE_PX / 2 - 2, y + TILE_PX / 2 - 2, 4, 4)
      })

      // tile 5: grass_side — brown with green top stripe and dirt variation
      drawProceduralTile(5, (context, x, y) => {
        // Dirt base with subtle variation
        context.fillStyle = '#8B4513'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        // Dirt speckles
        const dirtSpots = [[2,4],[6,8],[11,5],[15,10],[20,7],[25,3],[28,12],[4,18],[9,22],[18,19],[23,26],[27,20]] as const
        Arr.forEach(dirtSpots, ([sx, sy]) => {
          context.fillStyle = sx % 3 === 0 ? '#7a3a0e' : '#9a5520'
          context.fillRect(x + sx, y + sy + 4, 2, 2)
        })
        // Green top stripe with grass blades
        context.fillStyle = '#3a8a3a'
        context.fillRect(x, y, TILE_PX, 5)
        context.fillStyle = '#2d7a2d'
        for (let bx = 0; bx < TILE_PX; bx += 3) {
          context.fillRect(x + bx, y + 4, 1, 3)
        }
        // Transition zone (green seeping into dirt)
        context.fillStyle = '#4a7a3a'
        context.fillRect(x, y + 5, TILE_PX, 1)
      })

      // tile 7: water — blue with animated-look wave lines
      drawProceduralTile(7, (context, x, y) => {
        context.fillStyle = '#1a44bb'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        // Multiple wave layers
        for (let wy = 0; wy < TILE_PX; wy += 4) {
          context.fillStyle = wy % 8 === 0 ? '#2255cc' : '#1e4ecc'
          context.fillRect(x, y + wy, TILE_PX, 2)
        }
        // Foam/highlight dots
        const foamDots = [[3,1],[9,5],[15,1],[22,3],[27,7],[4,9],[12,13],[18,9],[25,13],[7,17],[14,17],[20,21],[2,21],[28,17],[6,25],[16,25],[24,29]] as const
        Arr.forEach(foamDots, ([fx, fy]) => {
          context.fillStyle = '#4488ee'
          context.fillRect(x + fx, y + fy, 2, 1)
        })
      })

      // tile 8: leaves — dark green with lighter spots and depth
      drawProceduralTile(8, (context, x, y) => {
        context.fillStyle = '#1a7a1a'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        // Light leaf spots in a pattern
        for (let lx = 0; lx < TILE_PX; lx += 4) {
          for (let ly = 0; ly < TILE_PX; ly += 4) {
            const variant = (lx + ly) % 12
            if (variant === 0) {
              context.fillStyle = '#228b22'
              context.fillRect(x + lx, y + ly, 3, 3)
            } else if (variant === 4) {
              context.fillStyle = '#2da02d'
              context.fillRect(x + lx + 1, y + ly + 1, 2, 2)
            } else if (variant === 8) {
              context.fillStyle = '#145014'
              context.fillRect(x + lx, y + ly, 2, 2)
            }
          }
        }
        // Dark gaps between clusters
        for (let gx = 2; gx < TILE_PX; gx += 5) {
          for (let gy = 2; gy < TILE_PX; gy += 5) {
            context.fillStyle = '#0f5a0f'
            context.fillRect(x + gx, y + gy, 1, 1)
          }
        }
      })

      // tile 9: glass — light blue with highlight border and faint interior lines
      drawProceduralTile(9, (context, x, y) => {
        // Base: semi-transparent-looking blue
        context.fillStyle = '#aaddff'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        // Inner gradient-like lighter zone
        context.fillStyle = '#c8eeff'
        context.fillRect(x + 2, y + 2, TILE_PX - 4, TILE_PX - 4)
        // Highlight edge top-left
        context.fillStyle = '#e0f8ff'
        context.fillRect(x + 1, y + 1, TILE_PX - 2, 2)
        context.fillRect(x + 1, y + 1, 2, TILE_PX - 2)
        // Shadow edge bottom-right
        context.fillStyle = '#88bbdd'
        context.fillRect(x + 1, y + TILE_PX - 3, TILE_PX - 2, 2)
        context.fillRect(x + TILE_PX - 3, y + 1, 2, TILE_PX - 2)
        // Faint cross reflection
        context.fillStyle = '#d8f0ff'
        context.fillRect(x + TILE_PX / 2 - 1, y + 4, 2, TILE_PX - 8)
        context.fillRect(x + 4, y + TILE_PX / 2 - 1, TILE_PX - 8, 2)
      })

      // tile 10: snow — near-white with blue tint and snowflake-like pattern
      drawProceduralTile(10, (context, x, y) => {
        context.fillStyle = '#f0f5ff'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        // Subtle blue-tint variation spots
        const snowDots = [[1,2],[5,0],[9,3],[13,1],[17,4],[21,0],[25,2],[29,4],[3,8],[7,6],[11,9],[15,7],[19,10],[23,6],[27,9],[0,14],[4,12],[8,15],[12,13],[16,16],[20,12],[24,15],[28,13],[2,20],[6,18],[10,21],[14,19],[18,22],[22,18],[26,21],[30,19],[1,26],[5,24],[9,27],[13,25],[17,28],[21,24],[25,27],[29,25]] as const
        for (let i = 0; i < snowDots.length; i++) {
          Option.map(Arr.get(snowDots, i), ([sx, sy]) => {
            context.fillStyle = i % 3 === 0 ? '#dde8ff' : (i % 3 === 1 ? '#e8f0ff' : '#ccdaff')
            context.fillRect(x + (sx % TILE_PX), y + (sy % TILE_PX), 2, 1)
          })
        }
      })

      // tile 11: gravel — grey-brown with varied speckles
      drawProceduralTile(11, (context, x, y) => {
        context.fillStyle = '#7a6a5a'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        // More speckles for 32×32
        const speckles = [
          [1,2,2,2],[4,5,3,3],[7,1,2,2],[10,8,3,2],[13,4,2,3],[16,0,2,2],[19,6,3,2],[22,3,2,3],
          [25,1,2,2],[28,5,3,3],[2,10,3,2],[5,14,2,3],[8,11,2,2],[11,15,3,2],[14,12,2,2],
          [17,10,3,3],[20,14,2,2],[23,11,3,2],[26,15,2,3],[0,19,2,2],[3,22,3,3],[6,18,2,2],
          [9,23,3,2],[12,20,2,3],[15,17,2,2],[18,22,3,2],[21,19,2,2],[24,23,3,3],[27,18,2,2],
          [1,28,3,2],[4,26,2,3],[7,29,2,2],[10,27,3,2],[13,25,2,2],[16,29,3,3],[19,26,2,2],
          [22,28,3,2],[25,25,2,3],[29,27,2,2],
        ] as const
        Arr.forEach(speckles, ([sx, sy, sw, sh]) => {
          const colors = ['#8a7a6a', '#6a5a4a', '#9a8a7a', '#5a4a3a', '#8a8070'] as const
          context.fillStyle = Option.getOrElse(Arr.get(colors, Math.floor((sx + sy) % 5)), () => '#8a7a6a' as const)
          context.fillRect(x + sx, y + sy, sw, sh)
        })
      })

      // tile 12: cobblestone — grey with stone-like patches and mortar lines
      drawProceduralTile(12, (context, x, y) => {
        // Mortar base
        context.fillStyle = '#606060'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        // Stone patches (more for 32×32)
        const patches = [
          [1, 1, 9, 8], [12, 1, 9, 8], [22, 1, 9, 8],
          [1, 11, 14, 8], [17, 11, 14, 8],
          [1, 21, 9, 9], [12, 21, 9, 9], [22, 21, 9, 9],
        ] as const
        Arr.forEach(patches, ([px, py, pw, ph]) => {
          // Stone fill color
          const variant = (px + py) % 3
          const stoneColor = variant === 0 ? '#787878' : (variant === 1 ? '#818181' : '#6f6f6f')
          context.fillStyle = stoneColor
          context.fillRect(x + px, y + py, pw, ph)
          // Highlight on stone face
          context.fillStyle = '#909090'
          context.fillRect(x + px + 1, y + py + 1, pw - 2, 1)
          context.fillRect(x + px + 1, y + py + 1, 1, ph - 2)
          // Shadow on stone face
          context.fillStyle = '#505050'
          context.fillRect(x + px + 1, y + py + ph - 2, pw - 2, 1)
          context.fillRect(x + px + pw - 2, y + py + 1, 1, ph - 2)
        })
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
  '@minecraft/infrastructure/three/ChunkMeshService',
  {
    scoped: Effect.gen(function* () {
      const atlasTexture = yield* Effect.acquireRelease(
        Effect.orDie(buildAtlasTexture()),
        (tex) => Effect.sync(() => tex.dispose())
      )

      const sharedMaterial = yield* Effect.acquireRelease(
        Effect.sync(() => new THREE.MeshStandardMaterial({
          map: atlasTexture,
          vertexColors: true,
          roughness: 0.8,
          metalness: 0,
        })),
        (mat) => Effect.sync(() => mat.dispose())
      )

      return {
        atlasTexture,

        createChunkMesh: (
          chunk: Chunk,
          waterMaterial?: THREE.ShaderMaterial
        ): Effect.Effect<{ opaqueMesh: THREE.Mesh; waterMesh: Option.Option<THREE.Mesh> }, never> =>
          Effect.sync(() => {
            const meshed = greedyMeshChunk(chunk, {
              wx: chunk.coord.x * CHUNK_SIZE,
              wz: chunk.coord.z * CHUNK_SIZE,
            }, TRANSPARENT_BLOCK_IDS)

            const opaqueGeometry = buildGeometry(meshed.opaque)
            const opaqueMesh = new THREE.Mesh(opaqueGeometry, sharedMaterial)
            opaqueMesh.castShadow = true
            opaqueMesh.receiveShadow = true
            opaqueMesh.userData['blockPositions'] = meshed.opaque.blockPositions
            opaqueMesh.userData['chunkCoord'] = chunk.coord

            const waterMesh: Option.Option<THREE.Mesh> = meshed.water.positions.length === 0
              ? Option.none()
              : Option.map(Option.fromNullable(waterMaterial), (mat) => {
                  const wm = new THREE.Mesh(buildGeometry(meshed.water), mat)
                  wm.castShadow = false
                  wm.receiveShadow = false
                  wm.renderOrder = 1
                  wm.userData['chunkCoord'] = chunk.coord
                  return wm
                })

            return { opaqueMesh, waterMesh }
          }),

        updateChunkMesh: (
          opaqueMesh: THREE.Mesh,
          waterMesh: Option.Option<THREE.Mesh>,
          chunk: Chunk
        ): Effect.Effect<void, never> =>
          Effect.sync(() => {
            const meshed = greedyMeshChunk(chunk, {
              wx: chunk.coord.x * CHUNK_SIZE,
              wz: chunk.coord.z * CHUNK_SIZE,
            }, TRANSPARENT_BLOCK_IDS)

            const oldOpaqueGeometry = opaqueMesh.geometry
            opaqueMesh.geometry = buildGeometry(meshed.opaque)
            opaqueMesh.userData['blockPositions'] = meshed.opaque.blockPositions
            opaqueMesh.userData['chunkCoord'] = chunk.coord
            oldOpaqueGeometry.dispose()

            Option.map(waterMesh, (wm) => {
              const oldWaterGeometry = wm.geometry
              wm.geometry = buildGeometry(meshed.water)
              wm.userData['chunkCoord'] = chunk.coord
              oldWaterGeometry.dispose()
            })
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
