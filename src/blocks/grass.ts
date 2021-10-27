import { Block } from './block'
import { texture, BlockTexture } from '@src/assets'

class Grass extends Block {
  protected texture: BlockTexture[] = texture.grass
}

export { Grass }
