/**
 * Generates individual tile PNGs and a combined atlas.png into /public/textures/.
 * Run once with: pnpm generate-textures
 *
 * - tile-{00-62}-*.png : individual 32×32 tiles for manual inspection/editing
 * - atlas.png          : 512×512 combined atlas loaded by chunk-mesh.ts at runtime
 *
 * Drawing logic is the single source of truth for all block and item appearance.
 * Tiles 0-47: block textures (indexed by TILE_MAP in block-texture-map.config.ts)
 * Tiles 48-62: item textures (indexed by ITEM_TILE_MAP in item-texture-map.config.ts)
 */

import { createCanvas } from '@napi-rs/canvas'
import { writeFileSync, mkdirSync } from 'fs'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUTPUT_DIR = join(__dirname, '../public/textures')
const TILE_PX = 32
const ATLAS_COLS = 16
const ATLAS_SIZE = 512  // ATLAS_COLS * TILE_PX

mkdirSync(OUTPUT_DIR, { recursive: true })

// Shared 512×512 atlas canvas — tiles are drawn here and into individual files.
const atlasCanvas = createCanvas(ATLAS_SIZE, ATLAS_SIZE)
const atlasCtx = atlasCanvas.getContext('2d')

// ── Tile coordinate data (from chunk-mesh.config.ts) ────────────────────────

const DIRT_SPOTS = [
  [2,4],[6,8],[11,5],[15,10],[20,7],[25,3],[28,12],[4,18],[9,22],[18,19],[23,26],[27,20],
]

const FOAM_DOTS = [
  [3,1],[9,5],[15,1],[22,3],[27,7],[4,9],[12,13],[18,9],[25,13],[7,17],[14,17],[20,21],[2,21],[28,17],[6,25],[16,25],[24,29],
]

const SNOW_DOTS = [
  [1,2],[5,0],[9,3],[13,1],[17,4],[21,0],[25,2],[29,4],[3,8],[7,6],[11,9],[15,7],[19,10],[23,6],[27,9],
  [0,14],[4,12],[8,15],[12,13],[16,16],[20,12],[24,15],[28,13],[2,20],[6,18],[10,21],[14,19],[18,22],[22,18],[26,21],[30,19],
  [1,26],[5,24],[9,27],[13,25],[17,28],[21,24],[25,27],[29,25],
]

const GRAVEL_SPECKLES = [
  [1,2,2,2],[4,5,3,3],[7,1,2,2],[10,8,3,2],[13,4,2,3],[16,0,2,2],[19,6,3,2],[22,3,2,3],
  [25,1,2,2],[28,5,3,3],[2,10,3,2],[5,14,2,3],[8,11,2,2],[11,15,3,2],[14,12,2,2],
  [17,10,3,3],[20,14,2,2],[23,11,3,2],[26,15,2,3],[0,19,2,2],[3,22,3,3],[6,18,2,2],
  [9,23,3,2],[12,20,2,3],[15,17,2,2],[18,22,3,2],[21,19,2,2],[24,23,3,3],[27,18,2,2],
  [1,28,3,2],[4,26,2,3],[7,29,2,2],[10,27,3,2],[13,25,2,2],[16,29,3,3],[19,26,2,2],
  [22,28,3,2],[25,25,2,3],[29,27,2,2],
]

const COBBLESTONE_PATCHES = [
  [1, 1, 9, 8], [12, 1, 9, 8], [22, 1, 9, 8],
  [1, 11, 14, 8], [17, 11, 14, 8],
  [1, 21, 9, 9], [12, 21, 9, 9], [22, 21, 9, 9],
]

const ORE_SPECKLES = [
  [3, 4, 3], [11, 2, 2], [20, 6, 3], [26, 3, 2],
  [5, 11, 2], [14, 9, 3], [22, 13, 2], [28, 15, 3],
  [2, 17, 3], [9, 20, 2], [17, 18, 3], [24, 22, 2],
  [6, 26, 2], [13, 28, 3], [21, 25, 2], [27, 29, 3],
]

const METAL_PANELS = [
  [1, 1, 14, 14],
  [17, 1, 14, 14],
  [1, 17, 14, 14],
  [17, 17, 14, 14],
]

const LAVA_HOT_SPOTS = [
  [4, 6], [12, 3], [20, 9], [28, 5],
  [8, 14], [17, 17], [25, 20], [6, 22],
  [13, 26], [23, 29], [2, 12], [29, 15],
]

const OBSIDIAN_PURPLES = [
  [5, 4], [13, 11], [22, 20], [27, 8],
]

// ── Drawing helpers ──────────────────────────────────────────────────────────

const drawNoise = (ctx, colors, density) => {
  for (let py = 0; py < TILE_PX; py++) {
    for (let px = 0; px < TILE_PX; px++) {
      const h = Math.sin(px * 12.9898 + py * 78.233 + colors.length) * 43758.5453
      const r = h - Math.floor(h)
      if (r < density) {
        ctx.fillStyle = colors[Math.floor(r * colors.length * 10) % colors.length]
        ctx.fillRect(px, py, 1, 1)
      }
    }
  }
}

const drawOreTile = (ctx, baseColor, baseNoise, oreColors) => {
  ctx.fillStyle = baseColor
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  drawNoise(ctx, baseNoise, 0.35)
  for (let i = 0; i < ORE_SPECKLES.length; i++) {
    const [sx, sy, sz] = ORE_SPECKLES[i]
    ctx.fillStyle = oreColors[i % oreColors.length]
    ctx.fillRect(sx, sy, sz, sz)
    ctx.fillStyle = oreColors[(i + 1) % oreColors.length]
    ctx.fillRect(sx + 1, sy + 1, Math.max(1, sz - 2), Math.max(1, sz - 2))
  }
}

const drawMetalBlock = (ctx, base, highlight, shadow) => {
  ctx.fillStyle = base
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  for (const [px, py, pw, ph] of METAL_PANELS) {
    ctx.fillStyle = highlight
    ctx.fillRect(px, py, pw, 1)
    ctx.fillRect(px, py, 1, ph)
    ctx.fillStyle = shadow
    ctx.fillRect(px, py + ph - 1, pw, 1)
    ctx.fillRect(px + pw - 1, py, 1, ph)
  }
}

// Creates a 32×32 canvas, calls drawFn, returns the canvas.
const makeTile = (drawFn) => {
  const canvas = createCanvas(TILE_PX, TILE_PX)
  const ctx = canvas.getContext('2d')
  drawFn(ctx)
  return canvas
}

const saveTile = (index, name, drawFn) => {
  const tile = makeTile(drawFn)

  // Paint into the shared atlas at the correct grid position.
  // Each tile occupies a disjoint region — concurrent writes are safe.
  const col = index % ATLAS_COLS
  const row = Math.floor(index / ATLAS_COLS)
  atlasCtx.drawImage(tile, col * TILE_PX, row * TILE_PX)

  // Also save as individual file for manual inspection and editing.
  const filename = `tile-${String(index).padStart(2, '0')}-${name}.png`
  writeFileSync(join(OUTPUT_DIR, filename), tile.toBuffer('image/png'))
  console.log(`  ✓ ${filename}`)
}

// ── Tile definitions ─────────────────────────────────────────────────────────

const STONE_BASE = '#7a7a7a'
const STONE_NOISE = ['#8a8a8a', '#6a6a6a', '#808080']
const DEEPSLATE_BASE = '#454545'
const DEEPSLATE_NOISE = ['#555555', '#353535', '#4a4a4a']

console.log('Generating textures...')

// tile 0: dirt
saveTile(0, 'dirt', (ctx) => {
  ctx.fillStyle = '#8B4513'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  for (const [sx, sy] of DIRT_SPOTS) {
    ctx.fillStyle = sx % 3 === 0 ? '#7a3a0e' : '#9a5520'
    ctx.fillRect(sx, sy, 2, 2)
  }
})

// tile 1: stone
saveTile(1, 'stone', (ctx) => {
  ctx.fillStyle = STONE_BASE
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  drawNoise(ctx, STONE_NOISE, 0.35)
})

// tile 2: wood_side (bark) — vertical lines
saveTile(2, 'wood-side', (ctx) => {
  ctx.fillStyle = '#5c4520'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  for (let bx = 2; bx < TILE_PX; bx += 5) {
    ctx.fillStyle = bx % 10 === 2 ? '#4a3410' : '#6e5530'
    ctx.fillRect(bx, 0, 2, TILE_PX)
  }
  ctx.fillStyle = '#3a2a0a'
  ctx.fillRect(8, 12, 3, 2)
  ctx.fillRect(22, 22, 3, 2)
})

// tile 3: wood_top — brown with concentric rings
saveTile(3, 'wood-top', (ctx) => {
  ctx.fillStyle = '#7a5c1e'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  ctx.strokeStyle = '#5c4414'
  ctx.lineWidth = 1
  for (let r = 2; r < TILE_PX / 2 - 1; r += 3) {
    ctx.beginPath()
    ctx.arc(TILE_PX / 2, TILE_PX / 2, r, 0, Math.PI * 2)
    ctx.stroke()
  }
  ctx.fillStyle = '#4a3010'
  ctx.fillRect(TILE_PX / 2 - 2, TILE_PX / 2 - 2, 4, 4)
})

// tile 4: grass_top — green top view
saveTile(4, 'grass-top', (ctx) => {
  ctx.fillStyle = '#3a8a3a'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  drawNoise(ctx, ['#2d7a2d', '#4a9a4a', '#228b22'], 0.3)
})

// tile 5: grass_side — dirt base with green top stripe
saveTile(5, 'grass-side', (ctx) => {
  ctx.fillStyle = '#8B4513'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  for (const [sx, sy] of DIRT_SPOTS) {
    ctx.fillStyle = sx % 3 === 0 ? '#7a3a0e' : '#9a5520'
    ctx.fillRect(sx, sy + 4, 2, 2)
  }
  ctx.fillStyle = '#3a8a3a'
  ctx.fillRect(0, 0, TILE_PX, 5)
  ctx.fillStyle = '#2d7a2d'
  for (let bx = 0; bx < TILE_PX; bx += 3) {
    ctx.fillRect(bx, 4, 1, 3)
  }
  ctx.fillStyle = '#4a7a3a'
  ctx.fillRect(0, 5, TILE_PX, 1)
})

// tile 6: sand — yellow-tan with noise
saveTile(6, 'sand', (ctx) => {
  ctx.fillStyle = '#deba6e'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  drawNoise(ctx, ['#c9a64a', '#e8cb80', '#d0b060'], 0.3)
})

// tile 7: water — blue with wave lines
saveTile(7, 'water', (ctx) => {
  ctx.fillStyle = '#1a44bb'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  for (let wy = 0; wy < TILE_PX; wy += 4) {
    ctx.fillStyle = wy % 8 === 0 ? '#2255cc' : '#1e4ecc'
    ctx.fillRect(0, wy, TILE_PX, 2)
  }
  for (const [fx, fy] of FOAM_DOTS) {
    ctx.fillStyle = '#4488ee'
    ctx.fillRect(fx, fy, 2, 1)
  }
})

// tile 8: leaves — dark green with lighter spots
saveTile(8, 'leaves', (ctx) => {
  ctx.fillStyle = '#1a7a1a'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  for (let lx = 0; lx < TILE_PX; lx += 4) {
    for (let ly = 0; ly < TILE_PX; ly += 4) {
      const variant = (lx + ly) % 12
      if (variant === 0) {
        ctx.fillStyle = '#228b22'
        ctx.fillRect(lx, ly, 3, 3)
      } else if (variant === 4) {
        ctx.fillStyle = '#2da02d'
        ctx.fillRect(lx + 1, ly + 1, 2, 2)
      } else if (variant === 8) {
        ctx.fillStyle = '#145014'
        ctx.fillRect(lx, ly, 2, 2)
      }
    }
  }
  for (let gx = 2; gx < TILE_PX; gx += 5) {
    for (let gy = 2; gy < TILE_PX; gy += 5) {
      ctx.fillStyle = '#0f5a0f'
      ctx.fillRect(gx, gy, 1, 1)
    }
  }
})

// tile 9: glass — light blue with highlight border
saveTile(9, 'glass', (ctx) => {
  ctx.fillStyle = '#aaddff'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  ctx.fillStyle = '#c8eeff'
  ctx.fillRect(2, 2, TILE_PX - 4, TILE_PX - 4)
  ctx.fillStyle = '#e0f8ff'
  ctx.fillRect(1, 1, TILE_PX - 2, 2)
  ctx.fillRect(1, 1, 2, TILE_PX - 2)
  ctx.fillStyle = '#88bbdd'
  ctx.fillRect(1, TILE_PX - 3, TILE_PX - 2, 2)
  ctx.fillRect(TILE_PX - 3, 1, 2, TILE_PX - 2)
  ctx.fillStyle = '#d8f0ff'
  ctx.fillRect(TILE_PX / 2 - 1, 4, 2, TILE_PX - 8)
  ctx.fillRect(4, TILE_PX / 2 - 1, TILE_PX - 8, 2)
})

// tile 10: snow — near-white with blue-tint dots
saveTile(10, 'snow', (ctx) => {
  ctx.fillStyle = '#f0f5ff'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  for (let i = 0; i < SNOW_DOTS.length; i++) {
    const [sx, sy] = SNOW_DOTS[i]
    ctx.fillStyle = i % 3 === 0 ? '#dde8ff' : (i % 3 === 1 ? '#e8f0ff' : '#ccdaff')
    ctx.fillRect(sx % TILE_PX, sy % TILE_PX, 2, 1)
  }
})

// tile 11: gravel — grey-brown with varied speckles
saveTile(11, 'gravel', (ctx) => {
  const colors = ['#8a7a6a', '#6a5a4a', '#9a8a7a', '#5a4a3a', '#8a8070']
  ctx.fillStyle = '#7a6a5a'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  for (const [sx, sy, sw, sh] of GRAVEL_SPECKLES) {
    ctx.fillStyle = colors[Math.floor((sx + sy) % 5)]
    ctx.fillRect(sx, sy, sw, sh)
  }
})

// tile 12: cobblestone — grey with stone patches and mortar
saveTile(12, 'cobblestone', (ctx) => {
  ctx.fillStyle = '#606060'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  for (const [px, py, pw, ph] of COBBLESTONE_PATCHES) {
    const variant = (px + py) % 3
    ctx.fillStyle = variant === 0 ? '#787878' : (variant === 1 ? '#818181' : '#6f6f6f')
    ctx.fillRect(px, py, pw, ph)
    ctx.fillStyle = '#909090'
    ctx.fillRect(px + 1, py + 1, pw - 2, 1)
    ctx.fillRect(px + 1, py + 1, 1, ph - 2)
    ctx.fillStyle = '#505050'
    ctx.fillRect(px + 1, py + ph - 2, pw - 2, 1)
    ctx.fillRect(px + pw - 2, py + 1, 1, ph - 2)
  }
})

// tile 13: granite
saveTile(13, 'granite', (ctx) => {
  ctx.fillStyle = '#9a6a5a'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  drawNoise(ctx, ['#b07868', '#8a5a4a', '#a56358'], 0.55)
})

// tile 14: diorite
saveTile(14, 'diorite', (ctx) => {
  ctx.fillStyle = '#bcbcbc'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  drawNoise(ctx, ['#e0e0e0', '#8a8a8a', '#d0d0d0'], 0.55)
})

// tile 15: andesite
saveTile(15, 'andesite', (ctx) => {
  ctx.fillStyle = '#888888'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  drawNoise(ctx, ['#a0a0a0', '#6a6a6a', '#909090'], 0.55)
})

// tile 16: deepslate — dark grey with vertical striations
saveTile(16, 'deepslate', (ctx) => {
  ctx.fillStyle = DEEPSLATE_BASE
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  drawNoise(ctx, DEEPSLATE_NOISE, 0.55)
  ctx.fillStyle = '#383838'
  for (let vx = 3; vx < TILE_PX; vx += 7) {
    ctx.fillRect(vx, 0, 1, TILE_PX)
  }
})

// tile 17: bedrock — near-black with crack pattern
saveTile(17, 'bedrock', (ctx) => {
  ctx.fillStyle = '#333333'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  drawNoise(ctx, ['#1c1c1c', '#505050', '#2a2a2a'], 0.65)
  ctx.fillStyle = '#555555'
  ctx.fillRect(3, 3, 1, 6)
  ctx.fillRect(10, 12, 8, 1)
  ctx.fillRect(22, 7, 1, 9)
  ctx.fillRect(6, 22, 12, 1)
})

// tile 18: lava — bright orange with yellow hotspots
saveTile(18, 'lava', (ctx) => {
  ctx.fillStyle = '#d44a10'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  drawNoise(ctx, ['#f07a20', '#b83308', '#e85a18'], 0.5)
  for (const [hx, hy] of LAVA_HOT_SPOTS) {
    ctx.fillStyle = '#ffd060'
    ctx.fillRect(hx, hy, 2, 2)
    ctx.fillStyle = '#ffff80'
    ctx.fillRect(hx, hy, 1, 1)
  }
})

// tile 19: obsidian — dark purple-black
saveTile(19, 'obsidian', (ctx) => {
  ctx.fillStyle = '#15101c'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  drawNoise(ctx, ['#1f1830', '#0a0515', '#28203a'], 0.55)
  for (const [px, py] of OBSIDIAN_PURPLES) {
    ctx.fillStyle = '#4a3060'
    ctx.fillRect(px, py, 2, 1)
  }
})

// tiles 20-26: stone ores
saveTile(20, 'coal-ore',     (ctx) => drawOreTile(ctx, STONE_BASE, STONE_NOISE, ['#151515', '#303030', '#000000']))
saveTile(21, 'iron-ore',     (ctx) => drawOreTile(ctx, STONE_BASE, STONE_NOISE, ['#b67a5a', '#d89878', '#9a5a3a']))
saveTile(22, 'gold-ore',     (ctx) => drawOreTile(ctx, STONE_BASE, STONE_NOISE, ['#f0c020', '#ffd840', '#c09010']))
saveTile(23, 'diamond-ore',  (ctx) => drawOreTile(ctx, STONE_BASE, STONE_NOISE, ['#40e0e0', '#80ffff', '#20a0c0']))
saveTile(24, 'redstone-ore', (ctx) => drawOreTile(ctx, STONE_BASE, STONE_NOISE, ['#d02020', '#ff4040', '#a01010']))
saveTile(25, 'lapis-ore',    (ctx) => drawOreTile(ctx, STONE_BASE, STONE_NOISE, ['#2050c0', '#4080ff', '#1030a0']))
saveTile(26, 'emerald-ore',  (ctx) => drawOreTile(ctx, STONE_BASE, STONE_NOISE, ['#20c040', '#60ff80', '#108020']))

// tiles 27-33: deepslate ores
saveTile(27, 'deepslate-coal-ore',     (ctx) => drawOreTile(ctx, DEEPSLATE_BASE, DEEPSLATE_NOISE, ['#080808', '#202020', '#000000']))
saveTile(28, 'deepslate-iron-ore',     (ctx) => drawOreTile(ctx, DEEPSLATE_BASE, DEEPSLATE_NOISE, ['#b67a5a', '#d89878', '#9a5a3a']))
saveTile(29, 'deepslate-gold-ore',     (ctx) => drawOreTile(ctx, DEEPSLATE_BASE, DEEPSLATE_NOISE, ['#f0c020', '#ffd840', '#c09010']))
saveTile(30, 'deepslate-diamond-ore',  (ctx) => drawOreTile(ctx, DEEPSLATE_BASE, DEEPSLATE_NOISE, ['#40e0e0', '#80ffff', '#20a0c0']))
saveTile(31, 'deepslate-redstone-ore', (ctx) => drawOreTile(ctx, DEEPSLATE_BASE, DEEPSLATE_NOISE, ['#d02020', '#ff4040', '#a01010']))
saveTile(32, 'deepslate-lapis-ore',    (ctx) => drawOreTile(ctx, DEEPSLATE_BASE, DEEPSLATE_NOISE, ['#2050c0', '#4080ff', '#1030a0']))
saveTile(33, 'deepslate-emerald-ore',  (ctx) => drawOreTile(ctx, DEEPSLATE_BASE, DEEPSLATE_NOISE, ['#20c040', '#60ff80', '#108020']))

// tiles 34-40: metal blocks
saveTile(34, 'coal-block',     (ctx) => drawMetalBlock(ctx, '#1a1a1a', '#3a3a3a', '#050505'))
saveTile(35, 'iron-block',     (ctx) => drawMetalBlock(ctx, '#d8d8d8', '#ffffff', '#a8a8a8'))
saveTile(36, 'gold-block',     (ctx) => drawMetalBlock(ctx, '#f0c020', '#fff080', '#b08000'))
saveTile(37, 'diamond-block',  (ctx) => drawMetalBlock(ctx, '#60e0d0', '#a0ffff', '#20a090'))
saveTile(38, 'redstone-block', (ctx) => drawMetalBlock(ctx, '#b01010', '#ff4040', '#700505'))
saveTile(39, 'lapis-block',    (ctx) => drawMetalBlock(ctx, '#2040a0', '#5080ff', '#102060'))
saveTile(40, 'emerald-block',  (ctx) => drawMetalBlock(ctx, '#20a040', '#80ff80', '#107020'))

// tile 41: planks
saveTile(41, 'planks', (ctx) => {
  ctx.fillStyle = '#b88754'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  ctx.fillStyle = '#9c6f40'
  for (let row = 0; row < TILE_PX; row += 8) {
    ctx.fillRect(0, row, TILE_PX, 2)
  }
  ctx.fillStyle = '#d2a46f'
  for (let knot = 4; knot < TILE_PX; knot += 10) {
    ctx.fillRect(knot, 4, 2, TILE_PX - 8)
  }
})

// tile 42: sticks
saveTile(42, 'sticks', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  ctx.fillStyle = '#c9a26b'
  ctx.fillRect(10, 2, 3, TILE_PX - 4)
  ctx.fillRect(18, 2, 3, TILE_PX - 4)
})

// tile 43: crafting table
saveTile(43, 'crafting-table', (ctx) => {
  ctx.fillStyle = '#7a4f2b'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  ctx.fillStyle = '#c69b6d'
  ctx.fillRect(3, 3, TILE_PX - 6, TILE_PX - 6)
  ctx.fillStyle = '#6a4020'
  ctx.fillRect(3, 15, TILE_PX - 6, 2)
  ctx.fillRect(15, 3, 2, TILE_PX - 6)
})

// tile 44: furnace
saveTile(44, 'furnace', (ctx) => {
  ctx.fillStyle = '#6a6a6a'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  ctx.fillStyle = '#8a8a8a'
  ctx.fillRect(3, 3, TILE_PX - 6, 6)
  ctx.fillStyle = '#2b2b2b'
  ctx.fillRect(7, 14, TILE_PX - 14, 10)
})

// tile 45: torch
saveTile(45, 'torch', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  ctx.fillStyle = '#d6b073'
  ctx.fillRect(14, 9, 4, TILE_PX - 13)
  ctx.fillStyle = '#ffcf5a'
  ctx.fillRect(10, 2, 12, 9)
  ctx.fillStyle = '#ff9f1c'
  ctx.fillRect(13, 4, 6, 5)
})

// tile 46: coal item — dark circle approximation
saveTile(46, 'coal-item', (ctx) => {
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  ctx.fillStyle = '#4a4a4a'
  ctx.fillRect(10, 8, 12, 16)
  ctx.fillRect(8, 10, 16, 12)
})

// tile 47: wooden sword
saveTile(47, 'wooden-sword', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  ctx.fillStyle = '#d0b07a'
  ctx.fillRect(15, 6, 2, 18)
  ctx.fillRect(10, 11, 12, 2)
  ctx.fillStyle = '#e8d0a8'
  ctx.fillRect(13, 2, 6, 10)
})

// ── Item tiles (48-62) ───────────────────────────────────────────────────────

// tile 48: sticks (improved — diagonal cross)
saveTile(48, 'item-sticks', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  ctx.fillStyle = '#c9a26b'
  // diagonal stick 1
  for (let i = 0; i < 20; i++) {
    ctx.fillRect(6 + i, 4 + i, 3, 1)
  }
  // diagonal stick 2
  for (let i = 0; i < 20; i++) {
    ctx.fillRect(22 - i, 6 + i, 3, 1)
  }
  ctx.fillStyle = '#b08a50'
  for (let i = 0; i < 18; i++) {
    ctx.fillRect(7 + i, 5 + i, 1, 1)
  }
})

// tile 49: coal (dark lumpy item)
saveTile(49, 'item-coal', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(9, 7, 14, 18)
  ctx.fillRect(7, 9, 18, 14)
  ctx.fillStyle = '#3a3a3a'
  ctx.fillRect(10, 8, 4, 3)
  ctx.fillRect(16, 14, 3, 4)
  ctx.fillStyle = '#0a0a0a'
  ctx.fillRect(12, 18, 5, 3)
})

// tile 50: wooden sword (improved)
saveTile(50, 'item-wooden-sword', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  // blade (wooden)
  ctx.fillStyle = '#e8d0a8'
  ctx.fillRect(14, 2, 4, 12)
  ctx.fillRect(12, 3, 8, 2)
  // crossguard
  ctx.fillStyle = '#8b6f47'
  ctx.fillRect(10, 13, 12, 3)
  // handle
  ctx.fillStyle = '#6b4423'
  ctx.fillRect(14, 16, 4, 10)
  // pommel
  ctx.fillStyle = '#8b6f47'
  ctx.fillRect(13, 25, 6, 3)
})

// tile 51: wooden pickaxe
saveTile(51, 'item-wooden-pickaxe', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  // handle (diagonal)
  ctx.fillStyle = '#6b4423'
  for (let i = 0; i < 22; i++) {
    ctx.fillRect(8 + Math.floor(i * 0.6), 10 + i, 2, 1)
  }
  // head
  ctx.fillStyle = '#c9a26b'
  ctx.fillRect(4, 2, 24, 3)
  ctx.fillRect(4, 5, 4, 4)
  ctx.fillRect(24, 5, 4, 4)
  ctx.fillStyle = '#e8d0a8'
  ctx.fillRect(10, 3, 12, 1)
})

// tile 52: stone pickaxe
saveTile(52, 'item-stone-pickaxe', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  // handle
  ctx.fillStyle = '#6b4423'
  for (let i = 0; i < 22; i++) {
    ctx.fillRect(8 + Math.floor(i * 0.6), 10 + i, 2, 1)
  }
  // stone head
  ctx.fillStyle = '#8a8a8a'
  ctx.fillRect(4, 2, 24, 4)
  ctx.fillRect(4, 6, 5, 4)
  ctx.fillRect(23, 6, 5, 4)
  ctx.fillStyle = '#aaaaaa'
  ctx.fillRect(10, 3, 12, 1)
})

// tile 53: raw iron (peach/tan lump)
saveTile(53, 'item-raw-iron', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  ctx.fillStyle = '#b38b6d'
  ctx.fillRect(8, 8, 16, 16)
  ctx.fillRect(6, 10, 20, 12)
  ctx.fillStyle = '#c9a080'
  ctx.fillRect(10, 9, 6, 4)
  ctx.fillStyle = '#8a6a4a'
  ctx.fillRect(14, 18, 5, 3)
})

// tile 54: iron ingot (metallic bar)
saveTile(54, 'item-iron-ingot', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  ctx.fillStyle = '#d8d8d8'
  ctx.fillRect(4, 10, 24, 12)
  ctx.fillStyle = '#eeeeee'
  ctx.fillRect(5, 11, 22, 2)
  ctx.fillRect(5, 11, 2, 9)
  ctx.fillStyle = '#a8a8a8'
  ctx.fillRect(5, 20, 22, 1)
  ctx.fillRect(26, 12, 1, 9)
  // trapezoid shape
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(2, 10, 2, 12)
  ctx.fillRect(28, 10, 2, 12)
})

// tile 55: iron pickaxe
saveTile(55, 'item-iron-pickaxe', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  // handle
  ctx.fillStyle = '#6b4423'
  for (let i = 0; i < 22; i++) {
    ctx.fillRect(8 + Math.floor(i * 0.6), 10 + i, 2, 1)
  }
  // iron head
  ctx.fillStyle = '#d8d8d8'
  ctx.fillRect(4, 2, 24, 4)
  ctx.fillRect(4, 6, 5, 4)
  ctx.fillRect(23, 6, 5, 4)
  ctx.fillStyle = '#eeeeee'
  ctx.fillRect(10, 3, 12, 1)
  ctx.fillStyle = '#a8a8a8'
  ctx.fillRect(4, 5, 24, 1)
})

// tile 56: raw gold (dark gold lump)
saveTile(56, 'item-raw-gold', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  ctx.fillStyle = '#c7a340'
  ctx.fillRect(8, 8, 16, 16)
  ctx.fillRect(6, 10, 20, 12)
  ctx.fillStyle = '#ddb850'
  ctx.fillRect(10, 9, 6, 4)
  ctx.fillStyle = '#9a7a20'
  ctx.fillRect(14, 18, 5, 3)
})

// tile 57: gold ingot (golden bar)
saveTile(57, 'item-gold-ingot', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  ctx.fillStyle = '#f0c020'
  ctx.fillRect(4, 10, 24, 12)
  ctx.fillStyle = '#ffd840'
  ctx.fillRect(5, 11, 22, 2)
  ctx.fillRect(5, 11, 2, 9)
  ctx.fillStyle = '#b08000'
  ctx.fillRect(5, 20, 22, 1)
  ctx.fillRect(26, 12, 1, 9)
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(2, 10, 2, 12)
  ctx.fillRect(28, 10, 2, 12)
})

// tile 58: diamond (cyan gem)
saveTile(58, 'item-diamond', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  // diamond shape
  ctx.fillStyle = '#40e0e0'
  ctx.fillRect(12, 4, 8, 4)
  ctx.fillRect(10, 8, 12, 4)
  ctx.fillRect(8, 12, 16, 4)
  ctx.fillRect(10, 16, 12, 4)
  ctx.fillRect(12, 20, 8, 4)
  // highlight
  ctx.fillStyle = '#80ffff'
  ctx.fillRect(14, 5, 4, 2)
  ctx.fillRect(12, 9, 4, 2)
  // shadow
  ctx.fillStyle = '#20a0c0'
  ctx.fillRect(18, 17, 3, 2)
  ctx.fillRect(12, 21, 4, 2)
})

// tile 59: redstone dust (red sparkly powder)
saveTile(59, 'item-redstone-dust', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  ctx.fillStyle = '#b02020'
  ctx.fillRect(6, 6, 20, 20)
  ctx.fillStyle = '#ff4040'
  ctx.fillRect(8, 8, 4, 4)
  ctx.fillRect(18, 12, 4, 4)
  ctx.fillRect(12, 18, 4, 4)
  ctx.fillStyle = '#801010'
  ctx.fillRect(14, 8, 6, 3)
  ctx.fillRect(8, 16, 5, 4)
  // sparkle dots
  ctx.fillStyle = '#ff8080'
  ctx.fillRect(10, 10, 2, 2)
  ctx.fillRect(20, 14, 2, 2)
})

// tile 60: lapis lazuli (blue stone)
saveTile(60, 'item-lapis-lazuli', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  ctx.fillStyle = '#2050c0'
  ctx.fillRect(8, 8, 16, 16)
  ctx.fillRect(6, 10, 20, 12)
  ctx.fillStyle = '#4080ff'
  ctx.fillRect(10, 9, 6, 4)
  ctx.fillRect(16, 16, 5, 3)
  ctx.fillStyle = '#1030a0'
  ctx.fillRect(14, 20, 4, 2)
})

// tile 61: emerald (green gem)
saveTile(61, 'item-emerald', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  // emerald shape — hexagonal
  ctx.fillStyle = '#20c040'
  ctx.fillRect(12, 4, 8, 4)
  ctx.fillRect(10, 8, 12, 4)
  ctx.fillRect(8, 12, 16, 4)
  ctx.fillRect(10, 16, 12, 4)
  ctx.fillRect(12, 20, 8, 4)
  // highlight
  ctx.fillStyle = '#60ff80'
  ctx.fillRect(14, 5, 3, 2)
  ctx.fillRect(12, 9, 3, 2)
  // shadow
  ctx.fillStyle = '#108020'
  ctx.fillRect(18, 17, 3, 2)
})

// tile 62: diamond pickaxe
saveTile(62, 'item-diamond-pickaxe', (ctx) => {
  ctx.fillStyle = '#3b2a18'
  ctx.fillRect(0, 0, TILE_PX, TILE_PX)
  // handle
  ctx.fillStyle = '#6b4423'
  for (let i = 0; i < 22; i++) {
    ctx.fillRect(8 + Math.floor(i * 0.6), 10 + i, 2, 1)
  }
  // diamond head
  ctx.fillStyle = '#60e0d0'
  ctx.fillRect(4, 2, 24, 4)
  ctx.fillRect(4, 6, 5, 4)
  ctx.fillRect(23, 6, 5, 4)
  ctx.fillStyle = '#a0ffff'
  ctx.fillRect(10, 3, 12, 1)
  ctx.fillStyle = '#20a090'
  ctx.fillRect(4, 5, 24, 1)
})

// Save combined atlas (single file loaded by chunk-mesh.ts at runtime).
writeFileSync(join(OUTPUT_DIR, 'atlas.png'), atlasCanvas.toBuffer('image/png'))
console.log(`  ✓ atlas.png (512×512, all 63 tiles combined)`)

console.log(`\nDone — 63 individual tiles + atlas.png written to ${OUTPUT_DIR}`)
