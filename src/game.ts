import { Scene, WebGLRenderer, Color } from 'three'

import { color } from '@src/assets'
import { ChunkInterface } from '@src/chunk'
import { adjustBlockFaces } from '@src/utils'
import { Camera } from '@src/camera'
import { Controller } from '@src/controller'

interface GameInterface {
  camera: Camera
  controls: Controller

  loop: (beforeUpdate: () => void, update: () => void, afterUpdate: () => void) => void

  addChunksToScene: (blocks: ChunkInterface['blocks']) => void
  addLineSegmentBlock: (blocks: ChunkInterface['blocks']) => void
  removeLineSegmentBlock: () => void
}

class Game implements GameInterface {
  private scene: Scene
  private renderer: WebGLRenderer
  public camera: Camera
  public controls: Controller

  constructor() {
    // for scene
    this.scene = new Scene()
    this.scene.background = new Color(color.sky)

    // for renderer
    this.renderer = new WebGLRenderer()
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    document.body.appendChild(this.renderer.domElement)

    // for camera
    this.camera = new Camera()

    // for control
    this.controls = new Controller(this.camera)

    // for resize event
    window.addEventListener('resize', this.handleResizeWindow.bind(this))
  }

  public loop(beforeUpdate: () => void, update: () => void, afterUpdate: () => void): void {
    requestAnimationFrame(this.loop.bind(this, beforeUpdate, update, afterUpdate))
    beforeUpdate()
    update()
    this.render()
    afterUpdate()
  }

  public addChunksToScene(blocks: ChunkInterface['blocks']): void {
    blocks.forEach((block) => {
      if (!block.isDisplayable) return

      const { blockMesh } = block.display(adjustBlockFaces(block, blocks))
      this.scene.add(blockMesh)
    })
  }

  public addLineSegmentBlock(blocks: ChunkInterface['blocks']): void {
    blocks.forEach((block) => {
      if (!block.isDisplayable) return

      const { lineSegment } = block.display(adjustBlockFaces(block, blocks))
      this.scene.add(lineSegment)
    })
  }

  public removeLineSegmentBlock(): void {
    this.scene.children.filter((obj) => obj.type === 'LineSegments').forEach((obj) => this.scene.remove(obj))
  }

  private render(): void {
    this.renderer.render(this.scene, this.camera.perspective)
  }

  private handleResizeWindow(): void {
    this.renderer.setSize(window.innerWidth, window.innerHeight)
    this.camera.handleResizeWindow()
  }
}

export { Game, GameInterface }
