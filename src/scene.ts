import { Scene as ThreeScene, Color } from 'three'

import { color } from '@src/assets'

class Scene extends ThreeScene {

  constructor() {
    super()
    this.background = new Color(color.sky)
  }
}

export { Scene }
