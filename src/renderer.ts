import { WebGLRenderer } from 'three'

import { windowSize } from '@src/assets'

class Renderer extends WebGLRenderer {
  constructor() {
    super()
    this.setSize(windowSize.width, windowSize.height)
    document.body.appendChild(this.domElement)
  }
}

export { Renderer }
