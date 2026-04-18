import { Array as Arr, Effect, Option } from 'effect'
import * as THREE from 'three'
import { Chunk } from '@/domain/chunk'
import { TextureError } from '@/domain'
import { ATLAS_COLS, ATLAS_SIZE } from '../textures/block-texture-map'
import { MeshedChunk } from './greedy-meshing'
import { MeshingWorkerPool } from './meshing-worker-pool'
import {
  DIRT_SPOTS,
  FOAM_DOTS,
  SNOW_DOTS,
  GRAVEL_SPECKLES,
  COBBLESTONE_PATCHES,
  ORE_SPECKLES,
  METAL_PANELS,
  LAVA_HOT_SPOTS,
  OBSIDIAN_PURPLES,
} from './chunk-mesh.config'

const TILE_PX = ATLAS_SIZE / ATLAS_COLS  // 32

// ─── Draw-call batching strategy ─────────────────────────────────────────────
//
// Why InstancedMesh is NOT used for chunk rendering:
//
// InstancedMesh requires many copies of the *same* geometry placed at different
// positions via per-instance transforms. It excels for particle systems, foliage
// billboards, or entity models where thousands of identical meshes exist.
//
// Chunk terrain does NOT fit this pattern because:
// 1. Greedy meshing (greedy-meshing.ts) already merges adjacent same-type blocks
//    into maximal rectangles. Each chunk produces a SINGLE merged BufferGeometry
//    with variable-size quads — not repeated identical geometry.
// 2. Each chunk's geometry is unique (different block arrangements, face counts,
//    AO values). There is no "template" geometry to instance.
// 3. One chunk = one draw call for opaque geometry (+ optionally one for water).
//    With render distance 8, that's ~200 opaque draw calls — well within GPU
//    command-buffer budgets. InstancedMesh would not reduce this.
//
// Current draw-call reduction techniques already in place:
// - Single shared MeshLambertMaterial (atlas texture) across ALL opaque chunks
// - Single shared ShaderMaterial across ALL water chunks
// - frustumCulled=false + manual AABB frustum culling in WorldRendererService
//   (cheaper than Three.js per-object bounding-sphere checks)
// - Shadow distance culling: castShadow disabled beyond shadow camera range
// - In-place GPU buffer reuse (tryReuseGeometry) avoids reallocation on update
// - Vertex colors encode per-vertex AO; no per-block-type material switching
//
// If InstancedMesh becomes beneficial in the future, candidates would be:
// - Entity rendering (mobs: cow, pig, sheep, zombie — identical box models)
// - Particle effects (block break particles, water splash)
// - Dropped item models
// ─────────────────────────────────────────────────────────────────────────────

const buildGeometry = (meshed: MeshedChunk): THREE.BufferGeometry => {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.BufferAttribute(meshed.positions, 3))
  geometry.setAttribute('normal', new THREE.BufferAttribute(meshed.normals, 3, true))
  geometry.setAttribute('color', new THREE.BufferAttribute(meshed.colors, 3, true))
  geometry.setAttribute('uv', new THREE.BufferAttribute(meshed.uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(meshed.indices, 1))
  return geometry
}

const getBufferAttr = (geometry: THREE.BufferGeometry, name: string): THREE.BufferAttribute | null => {
  const attr = geometry.getAttribute(name)
  return attr instanceof THREE.BufferAttribute ? attr : null
}

const copyAndMark = (attr: THREE.BufferAttribute, data: ArrayLike<number>): void => {
  attr.copyArray(data)
  attr.needsUpdate = true
}

// Performance boundary: reuse existing GPU buffers when capacity is sufficient.
// Returns true if in-place update succeeded, false if caller must do full rebuild.
//
// Accepts MeshedChunk (owned arrays from worker transfer or toMeshed() slice).
// With worker-sourced data the .slice() allocation happens in the worker thread,
// so the main thread only pays for the GPU copy here — no intermediate GC pressure.
const tryReuseGeometry = (geometry: THREE.BufferGeometry, meshed: MeshedChunk): boolean => {
  const posAttr = getBufferAttr(geometry, 'position')
  if (!posAttr || posAttr.count * 3 < meshed.positions.length) return false
  copyAndMark(posAttr, meshed.positions)

  const normalAttr = getBufferAttr(geometry, 'normal')
  if (!normalAttr) return false
  copyAndMark(normalAttr, meshed.normals)

  const colorAttr = getBufferAttr(geometry, 'color')
  if (!colorAttr) return false
  copyAndMark(colorAttr, meshed.colors)

  const uvAttr = getBufferAttr(geometry, 'uv')
  if (!uvAttr) return false
  copyAndMark(uvAttr, meshed.uvs)

  const indexAttr = geometry.getIndex()
  if (indexAttr instanceof THREE.BufferAttribute && indexAttr.count >= meshed.indices.length) {
    copyAndMark(indexAttr, meshed.indices)
  } else {
    geometry.setIndex(new THREE.BufferAttribute(meshed.indices, 1))
  }
  geometry.setDrawRange(0, meshed.indices.length)

  return true
}

const buildAtlasTexture = (): Effect.Effect<THREE.Texture, TextureError> =>
  Effect.gen(function* () {
      const canvas = document.createElement('canvas')
      canvas.width = ATLAS_SIZE
      canvas.height = ATLAS_SIZE
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new Error('Failed to acquire 2D canvas context for atlas build')
      }

      const drawImageTile = (url: string, tileIndex: number): Effect.Effect<void> =>
        Effect.async((resume) => {
          const img = new Image()
          img.onload = () => {
            const col = tileIndex % ATLAS_COLS
            const row = Math.floor(tileIndex / ATLAS_COLS)
            ctx.drawImage(img, col * TILE_PX, row * TILE_PX, TILE_PX, TILE_PX)
            resume(Effect.void)
          }
          img.onerror = (e) => {
            Effect.runFork(Effect.logWarning(`Failed to load texture: ${url} — ${String(e)}`))
            resume(Effect.void)
          }
          img.src = url
          return Effect.sync(() => {
            img.onload = null
            img.onerror = null
          })
        })

      const drawProceduralTile = (
        tileIndex: number,
        drawFn: (context: CanvasRenderingContext2D, x: number, y: number) => void
      ): void => {
        const col = tileIndex % ATLAS_COLS
        const row = Math.floor(tileIndex / ATLAS_COLS)
        drawFn(ctx, col * TILE_PX, row * TILE_PX)
      }

      yield* Effect.forEach(
        [
          ['/textures/dirt.png', 0],
          ['/textures/stone.png', 1],
          ['/textures/wood.png', 2],
          ['/textures/grass.png', 4],
          ['/textures/sand.png', 6],
        ] as const,
        ([url, tileIndex]) => drawImageTile(url, tileIndex),
        { concurrency: 'unbounded' }
      )

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
        Arr.forEach(DIRT_SPOTS, ([sx, sy]) => {
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
        Arr.forEach(FOAM_DOTS, ([fx, fy]) => {
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
        Arr.forEach(SNOW_DOTS, ([sx, sy], i) => {
          context.fillStyle = i % 3 === 0 ? '#dde8ff' : (i % 3 === 1 ? '#e8f0ff' : '#ccdaff')
          context.fillRect(x + (sx % TILE_PX), y + (sy % TILE_PX), 2, 1)
        })
      })

      // tile 11: gravel — grey-brown with varied speckles
      drawProceduralTile(11, (context, x, y) => {
        context.fillStyle = '#7a6a5a'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        Arr.forEach(GRAVEL_SPECKLES, ([sx, sy, sw, sh]) => {
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
        Arr.forEach(COBBLESTONE_PATCHES, ([px, py, pw, ph]) => {
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


      const drawSolidBase = (context: CanvasRenderingContext2D, x: number, y: number, fill: string) => {
        context.fillStyle = fill
        context.fillRect(x, y, TILE_PX, TILE_PX)
      }

      const drawNoise = (
        context: CanvasRenderingContext2D, x: number, y: number,
        colors: ReadonlyArray<string>, density: number
      ) => {
        for (let py = 0; py < TILE_PX; py++) {
          for (let px = 0; px < TILE_PX; px++) {
            const h = Math.sin(px * 12.9898 + py * 78.233 + colors.length) * 43758.5453
            const r = h - Math.floor(h)
            if (r < density) {
              context.fillStyle = Option.getOrElse(
                Arr.get(colors, Math.floor(r * colors.length * 10) % colors.length),
                () => '#000000' as string
              )
              context.fillRect(x + px, y + py, 1, 1)
            }
          }
        }
      }

      const drawOreTile = (
        tileIndex: number,
        baseColor: string,
        baseNoise: ReadonlyArray<string>,
        oreColors: ReadonlyArray<string>
      ) => {
        drawProceduralTile(tileIndex, (context, x, y) => {
          drawSolidBase(context, x, y, baseColor)
          drawNoise(context, x, y, baseNoise, 0.35)
          Arr.forEach(ORE_SPECKLES, ([sx, sy, sz], i) => {
            context.fillStyle = Option.getOrElse(
              Arr.get(oreColors, i % oreColors.length),
              () => '#000000' as string
            )
            context.fillRect(x + sx, y + sy, sz, sz)
            // inner highlight
            context.fillStyle = Option.getOrElse(
              Arr.get(oreColors, (i + 1) % oreColors.length),
              () => '#ffffff' as string
            )
            context.fillRect(x + sx + 1, y + sy + 1, Math.max(1, sz - 2), Math.max(1, sz - 2))
          })
        })
      }

      // tile 13: granite — reddish pink rock
      drawProceduralTile(13, (context, x, y) => {
        drawSolidBase(context, x, y, '#9a6a5a')
        drawNoise(context, x, y, ['#b07868', '#8a5a4a', '#a56358'], 0.55)
      })

      // tile 14: diorite — white/grey rock
      drawProceduralTile(14, (context, x, y) => {
        drawSolidBase(context, x, y, '#bcbcbc')
        drawNoise(context, x, y, ['#e0e0e0', '#8a8a8a', '#d0d0d0'], 0.55)
      })

      // tile 15: andesite — medium grey
      drawProceduralTile(15, (context, x, y) => {
        drawSolidBase(context, x, y, '#888888')
        drawNoise(context, x, y, ['#a0a0a0', '#6a6a6a', '#909090'], 0.55)
      })

      // tile 16: deepslate — dark grey with column striations
      drawProceduralTile(16, (context, x, y) => {
        drawSolidBase(context, x, y, '#454545')
        drawNoise(context, x, y, ['#555555', '#353535', '#4a4a4a'], 0.55)
        // Faint vertical striations (columnar look)
        context.fillStyle = '#383838'
        for (let vx = 3; vx < TILE_PX; vx += 7) {
          context.fillRect(x + vx, y, 1, TILE_PX)
        }
      })

      // tile 17: bedrock — near-black with crack pattern
      drawProceduralTile(17, (context, x, y) => {
        drawSolidBase(context, x, y, '#333333')
        drawNoise(context, x, y, ['#1c1c1c', '#505050', '#2a2a2a'], 0.65)
        context.fillStyle = '#555555'
        context.fillRect(x + 3, y + 3, 1, 6)
        context.fillRect(x + 10, y + 12, 8, 1)
        context.fillRect(x + 22, y + 7, 1, 9)
        context.fillRect(x + 6, y + 22, 12, 1)
      })

      // tile 18: lava — bright orange with yellow hotspots
      drawProceduralTile(18, (context, x, y) => {
        drawSolidBase(context, x, y, '#d44a10')
        drawNoise(context, x, y, ['#f07a20', '#b83308', '#e85a18'], 0.5)
        // hot yellow spots
        Arr.forEach(LAVA_HOT_SPOTS, ([hx, hy]) => {
          context.fillStyle = '#ffd060'
          context.fillRect(x + hx, y + hy, 2, 2)
          context.fillStyle = '#ffff80'
          context.fillRect(x + hx, y + hy, 1, 1)
        })
      })

      // tile 19: obsidian — dark purple-black
      drawProceduralTile(19, (context, x, y) => {
        drawSolidBase(context, x, y, '#15101c')
        drawNoise(context, x, y, ['#1f1830', '#0a0515', '#28203a'], 0.55)
        // subtle purple highlights
        Arr.forEach(OBSIDIAN_PURPLES, ([px, py]) => {
          context.fillStyle = '#4a3060'
          context.fillRect(x + px, y + py, 2, 1)
        })
      })

      const STONE_BASE = '#7a7a7a'
      const STONE_NOISE = ['#8a8a8a', '#6a6a6a', '#808080']
      const DEEPSLATE_BASE = '#454545'
      const DEEPSLATE_NOISE = ['#555555', '#353535', '#4a4a4a']

      // tile 20: coal_ore
      drawOreTile(20, STONE_BASE, STONE_NOISE, ['#151515', '#303030', '#000000'])
      // tile 21: iron_ore — tan/pink specks
      drawOreTile(21, STONE_BASE, STONE_NOISE, ['#b67a5a', '#d89878', '#9a5a3a'])
      // tile 22: gold_ore
      drawOreTile(22, STONE_BASE, STONE_NOISE, ['#f0c020', '#ffd840', '#c09010'])
      // tile 23: diamond_ore
      drawOreTile(23, STONE_BASE, STONE_NOISE, ['#40e0e0', '#80ffff', '#20a0c0'])
      // tile 24: redstone_ore
      drawOreTile(24, STONE_BASE, STONE_NOISE, ['#d02020', '#ff4040', '#a01010'])
      // tile 25: lapis_ore
      drawOreTile(25, STONE_BASE, STONE_NOISE, ['#2050c0', '#4080ff', '#1030a0'])
      // tile 26: emerald_ore
      drawOreTile(26, STONE_BASE, STONE_NOISE, ['#20c040', '#60ff80', '#108020'])
      // tile 27-33: deepslate ore variants
      drawOreTile(27, DEEPSLATE_BASE, DEEPSLATE_NOISE, ['#080808', '#202020', '#000000'])
      drawOreTile(28, DEEPSLATE_BASE, DEEPSLATE_NOISE, ['#b67a5a', '#d89878', '#9a5a3a'])
      drawOreTile(29, DEEPSLATE_BASE, DEEPSLATE_NOISE, ['#f0c020', '#ffd840', '#c09010'])
      drawOreTile(30, DEEPSLATE_BASE, DEEPSLATE_NOISE, ['#40e0e0', '#80ffff', '#20a0c0'])
      drawOreTile(31, DEEPSLATE_BASE, DEEPSLATE_NOISE, ['#d02020', '#ff4040', '#a01010'])
      drawOreTile(32, DEEPSLATE_BASE, DEEPSLATE_NOISE, ['#2050c0', '#4080ff', '#1030a0'])
      drawOreTile(33, DEEPSLATE_BASE, DEEPSLATE_NOISE, ['#20c040', '#60ff80', '#108020'])

      const drawMetalBlock = (
        tileIndex: number,
        base: string,
        highlight: string,
        shadow: string
      ) => {
        drawProceduralTile(tileIndex, (context, x, y) => {
          drawSolidBase(context, x, y, base)
          // 4 brick-like panels per tile — fake metallic sheen
          Arr.forEach(METAL_PANELS, ([px, py, pw, ph]) => {
            context.fillStyle = highlight
            context.fillRect(x + px, y + py, pw, 1)
            context.fillRect(x + px, y + py, 1, ph)
            context.fillStyle = shadow
            context.fillRect(x + px, y + py + ph - 1, pw, 1)
            context.fillRect(x + px + pw - 1, y + py, 1, ph)
          })
        })
      }

      // tile 34: coal_block
      drawMetalBlock(34, '#1a1a1a', '#3a3a3a', '#050505')
      // tile 35: iron_block
      drawMetalBlock(35, '#d8d8d8', '#ffffff', '#a8a8a8')
      // tile 36: gold_block
      drawMetalBlock(36, '#f0c020', '#fff080', '#b08000')
      // tile 37: diamond_block
      drawMetalBlock(37, '#60e0d0', '#a0ffff', '#20a090')
      // tile 38: redstone_block
      drawMetalBlock(38, '#b01010', '#ff4040', '#700505')
      // tile 39: lapis_block
      drawMetalBlock(39, '#2040a0', '#5080ff', '#102060')
      // tile 40: emerald_block
      drawMetalBlock(40, '#20a040', '#80ff80', '#107020')

      // tile 41: planks
      drawProceduralTile(41, (context, x, y) => {
        context.fillStyle = '#b88754'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        context.fillStyle = '#9c6f40'
        for (let row = 0; row < TILE_PX; row += 8) {
          context.fillRect(x, y + row, TILE_PX, 2)
        }
        context.fillStyle = '#d2a46f'
        for (let knot = 4; knot < TILE_PX; knot += 10) {
          context.fillRect(x + knot, y + 4, 2, TILE_PX - 8)
        }
      })

      // tile 42: sticks
      drawProceduralTile(42, (context, x, y) => {
        context.fillStyle = '#3b2a18'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        context.fillStyle = '#c9a26b'
        context.fillRect(x + 10, y + 2, 3, TILE_PX - 4)
        context.fillRect(x + 18, y + 2, 3, TILE_PX - 4)
      })

      // tile 43: crafting table
      drawProceduralTile(43, (context, x, y) => {
        context.fillStyle = '#7a4f2b'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        context.fillStyle = '#c69b6d'
        context.fillRect(x + 3, y + 3, TILE_PX - 6, TILE_PX - 6)
        context.fillStyle = '#6a4020'
        context.fillRect(x + 3, y + 15, TILE_PX - 6, 2)
        context.fillRect(x + 15, y + 3, 2, TILE_PX - 6)
      })

      // tile 44: furnace
      drawProceduralTile(44, (context, x, y) => {
        context.fillStyle = '#6a6a6a'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        context.fillStyle = '#8a8a8a'
        context.fillRect(x + 3, y + 3, TILE_PX - 6, 6)
        context.fillStyle = '#2b2b2b'
        context.fillRect(x + 7, y + 14, TILE_PX - 14, 10)
      })

      // tile 45: torch
      drawProceduralTile(45, (context, x, y) => {
        context.fillStyle = '#3b2a18'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        context.fillStyle = '#d6b073'
        context.fillRect(x + 14, y + 9, 4, TILE_PX - 13)
        context.fillStyle = '#ffcf5a'
        context.fillRect(x + 10, y + 2, 12, 9)
        context.fillStyle = '#ff9f1c'
        context.fillRect(x + 13, y + 4, 6, 5)
      })

      // tile 46: coal — circle approximated with fillRect diamond to avoid context.arc/fill (jsdom)
      drawProceduralTile(46, (context, x, y) => {
        context.fillStyle = '#1a1a1a'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        context.fillStyle = '#4a4a4a'
        context.fillRect(x + 10, y + 8, 12, 16)
        context.fillRect(x + 8, y + 10, 16, 12)
      })

      // tile 47: wooden sword — blade tip approximated with fillRect to avoid path ops (jsdom)
      drawProceduralTile(47, (context, x, y) => {
        context.fillStyle = '#3b2a18'
        context.fillRect(x, y, TILE_PX, TILE_PX)
        context.fillStyle = '#d0b07a'
        context.fillRect(x + 15, y + 6, 2, 18)
        context.fillRect(x + 10, y + 11, 12, 2)
        context.fillStyle = '#e8d0a8'
        context.fillRect(x + 13, y + 2, 6, 10)
      })

      const texture = new THREE.CanvasTexture(canvas)
      texture.magFilter = THREE.NearestFilter
      texture.minFilter = THREE.NearestFilter
      texture.generateMipmaps = false
      texture.wrapS = THREE.ClampToEdgeWrapping
      texture.wrapT = THREE.ClampToEdgeWrapping
      return texture
    }).pipe(Effect.mapError((cause) => new TextureError({ url: '/textures/atlas', cause })))

export class ChunkMeshService extends Effect.Service<ChunkMeshService>()(
  '@minecraft/infrastructure/three/ChunkMeshService',
  {
    scoped: Effect.gen(function* () {
      const [pool, atlasTexture] = yield* Effect.all(
        [MeshingWorkerPool, Effect.orDie(buildAtlasTexture())],
        { concurrency: 'unbounded' }
      )

      // Per-vertex colors encode three light factors normalized to [0,1] in the shader:
      //   R = ambient occlusion (1 = unoccluded, 0 = fully occluded)
      //   G = sky-light factor   (skyLight / 15)
      //   B = block-light factor (blockLight / 15)
      //
      // The patch below replaces Three.js' vertex-color contribution to combine sky and block
      // light (so torchlight at night is bright like vanilla) and modulate the result by AO.
      // uSunIntensity is exposed per-material (default 1.0 = full daylight); a future
      // time-of-day system can ramp this between 0 and 1 for diurnal cycles.
      const sharedUniforms = { uSunIntensity: { value: 1.0 } }
      const sharedMaterial = yield* Effect.acquireRelease(
        Effect.sync(() => {
          const mat = new THREE.MeshLambertMaterial({
            map: atlasTexture,
            vertexColors: true,
          })
          mat.onBeforeCompile = (shader) => {
            shader.uniforms['uSunIntensity'] = sharedUniforms.uSunIntensity
            // Inject lighting compute into the fragment shader. We replace the standard
            // <color_fragment> chunk (which would multiply diffuseColor by vColor as a tint)
            // with our own combine: sky*sun + block (max-blended), then modulated by AO.
            // The shader's vColor varying carries (R=AO, G=sky, B=block) in [0,1] from the
            // BufferAttribute's `normalized: true` flag.
            // Guard against Three.js upgrade silently breaking smooth-lighting injection.
            if (!shader.fragmentShader.includes('void main() {') || !shader.fragmentShader.includes('#include <color_fragment>')) {
              throw new Error('chunk-mesh: Three.js fragment shader tokens for smooth-lighting injection not found — lighting injection will silently no-op')
            }
            shader.fragmentShader = shader.fragmentShader
              .replace(
                'void main() {',
                `uniform float uSunIntensity;\nvoid main() {`
              )
              .replace(
                '#include <color_fragment>',
                `#ifdef USE_COLOR
                   float aoFactor = vColor.r;
                   float skyFactor = vColor.g;
                   float blockFactor = vColor.b;
                   float lightFactor = max(skyFactor * uSunIntensity, blockFactor);
                   diffuseColor.rgb *= (0.15 + 0.85 * lightFactor) * (0.7 + 0.3 * aoFactor);
                 #endif`
              )
          }
          // Three.js caches compiled programs by material UUID + defines; ensure recompile
          // by setting needsUpdate after assignment.
          mat.needsUpdate = true
          return mat
        }),
        (mat) => Effect.sync(() => mat.dispose())
      )

      return {
        atlasTexture,

        createChunkMesh: (
          chunk: Chunk,
          waterMaterial?: THREE.ShaderMaterial
        ): Effect.Effect<{ opaqueMesh: THREE.Mesh; waterMesh: Option.Option<THREE.Mesh> }, never> =>
          pool.meshChunk(chunk).pipe(
            Effect.map(({ opaque, water }) => {
              const opaqueGeometry = buildGeometry(opaque)
              // All opaque chunks share ONE material instance (sharedMaterial above) —
              // this lets Three.js batch state changes and avoids GPU material switches.
              const opaqueMesh = new THREE.Mesh(opaqueGeometry, sharedMaterial)
              // Disable Three.js per-object bounding-sphere frustum culling;
              // WorldRendererService.applyFrustumCulling does chunk-level AABB culling
              // which is more efficient (known fixed-size boxes, no bounding-sphere compute).
              opaqueMesh.frustumCulled = false
              opaqueMesh.castShadow = true
              opaqueMesh.receiveShadow = true
              opaqueMesh.userData['chunkCoord'] = chunk.coord

              const waterMesh: Option.Option<THREE.Mesh> = water === null || water.positions.length === 0
                ? Option.none()
                // All water chunks share ONE ShaderMaterial instance (waterMaterial from WorldRendererService)
                : Option.map(Option.fromNullable(waterMaterial), (mat) => {
                    const wm = new THREE.Mesh(buildGeometry(water), mat)
                    wm.frustumCulled = false  // manual AABB culling in WorldRendererService
                    wm.castShadow = false
                    wm.receiveShadow = false
                    wm.renderOrder = 1
                    wm.userData['chunkCoord'] = chunk.coord
                    return wm
                  })

              return { opaqueMesh, waterMesh }
            })
          ),

        updateChunkMesh: (
          opaqueMesh: THREE.Mesh,
          waterMesh: Option.Option<THREE.Mesh>,
          chunk: Chunk,
          waterMaterial?: THREE.ShaderMaterial
        ): Effect.Effect<Option.Option<THREE.Mesh>, never> =>
          pool.meshChunk(chunk).pipe(
            Effect.map(({ opaque, water }) => {
              // Opaque mesh: in-place update using owned arrays from worker transfer.
              // Falls back to full geometry rebuild only when buffer capacity is insufficient.
              if (!tryReuseGeometry(opaqueMesh.geometry, opaque)) {
                const oldGeom = opaqueMesh.geometry
                opaqueMesh.geometry = buildGeometry(opaque)
                oldGeom.dispose()
              }

              opaqueMesh.userData['chunkCoord'] = { x: chunk.coord.x, z: chunk.coord.z }

              // Water mesh: update in place when it already exists, or create/remove it when topology changes.
              return Option.match(waterMesh, {
                onNone: () => {
                  if (water === null || water.positions.length === 0) {
                    return Option.none()
                  }
                  return Option.match(Option.fromNullable(waterMaterial), {
                    onNone: () => Option.none(),
                    onSome: (mat) => {
                      const wm = new THREE.Mesh(buildGeometry(water), mat)
                      wm.frustumCulled = false
                      wm.castShadow = false
                      wm.receiveShadow = false
                      wm.renderOrder = 1
                      wm.userData['chunkCoord'] = chunk.coord
                      return Option.some(wm)
                    },
                  })
                },
                onSome: (wm) => {
                  if (water === null || water.positions.length === 0) {
                    wm.geometry.dispose()
                    return Option.none()
                  }
                  if (!tryReuseGeometry(wm.geometry, water)) {
                    const oldWaterGeometry = wm.geometry
                    wm.geometry = buildGeometry(water)
                    oldWaterGeometry.dispose()
                  }
                  wm.userData['chunkCoord'] = chunk.coord
                  return waterMesh
                },
              })
            })
          ),

        disposeMesh: (mesh: THREE.Mesh): Effect.Effect<void, never> =>
          Effect.sync(() => {
            mesh.geometry.dispose()
          }),

        /**
         * Adjust the sun-light intensity uniform on the shared opaque chunk material.
         * Value is clamped to [0, 1]. Future TimeService can drive this from day-night cycle.
         */
        setSunIntensity: (value: number): Effect.Effect<void, never> =>
          Effect.sync(() => {
            sharedUniforms.uSunIntensity.value = Math.max(0, Math.min(1, value))
          }),
      }
    }),
    dependencies: [MeshingWorkerPool.Default],
  }
) {}
export const ChunkMeshServiceLive = ChunkMeshService.Default
