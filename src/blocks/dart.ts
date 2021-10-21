import { Block } from './block'
import { texture } from '@src/assets'

class Dart extends Block {
  protected texture: THREE.MeshBasicMaterial[] = texture.dart
}

export { Dart }
