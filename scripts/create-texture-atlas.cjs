const { createCanvas, loadImage } = require('canvas')
const fs = require('fs')
const path = require('path')

const TILE_SIZE = 16 // Each texture is 16x16 pixels
const ATLAS_WIDTH_IN_TILES = 4
const ATLAS_SIZE = TILE_SIZE * ATLAS_WIDTH_IN_TILES

const textureMap = {
  grass: { top: [0, 0], side: [1, 0], bottom: [2, 0] },
  dirt: { side: [2, 0] },
  sand: { side: [0, 1] },
  stone: { side: [1, 1] },
  cobblestone: { side: [2, 1] },
  water: { side: [3, 1] },
  oakLog: { top: [0, 2], side: [1, 2], bottom: [0, 2] },
  oakLeaves: { side: [2, 2] },
  glass: { side: [3, 2] },
  brick: { side: [0, 3] },
  plank: { side: [1, 3] },
}

async function createTextureAtlas() {
  const canvas = createCanvas(ATLAS_SIZE, ATLAS_SIZE)
  const ctx = canvas.getContext('2d')

  console.log('Creating texture atlas...')

  for (const blockType in textureMap) {
    for (const faceName in textureMap[blockType]) {
      const [x, y] = textureMap[blockType][faceName]
      const imagePath = path.join(
        __dirname,
        `../public/assets/${blockType}/
          ${faceName === 'side' ? 'side' : faceName}.jpeg`,
      )

      try {
        if (fs.existsSync(imagePath)) {
          const image = await loadImage(imagePath)
          ctx.drawImage(image, x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE)
          console.log(`  - Placed ${blockType}/${faceName} at (${x}, ${y})`)
        } else {
          console.warn(`  - Texture not found, skipping: ${imagePath}`)
        }
      } catch (error) {
        console.error(`Error loading image ${imagePath}:`, error)
      }
    }
  }

  const outPath = path.join(__dirname, '../public/assets/texture-atlas.png')
  const out = fs.createWriteStream(outPath)
  const stream = canvas.createPNGStream()
  stream.pipe(out)
  out.on('finish', () => console.log(`\nTexture atlas saved to ${outPath}`))
}

createTextureAtlas()
