import { Block } from './block'
import { texture } from '@src/assets'

class Grass extends Block {
  protected texture: BlockTexture[] = texture.grass
}

export { Grass }
