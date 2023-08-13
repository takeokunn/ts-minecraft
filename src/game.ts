import { Chunk } from '@src/chunk'
import { adjustBlockFaces } from '@src/utils'
import { Camera } from '@src/camera'
import { Controller } from '@src/controller'
import { Scene } from '@src/scene'
import { Renderer } from '@src/renderer'
import { windowSize } from '@src/assets'

interface GameInterface {
  camera: Camera
  controls: Controller

  loop: (beforeUpdate: () => void, update: () => void, afterUpdate: () => void) => void

  addChunksToScene: (blocks: Chunk['blocks']) => void
  addLineSegmentBlock: (blocks: Chunk['blocks']) => void
  removeLineSegmentBlock: () => void
}

class Game implements GameInterface {
  private scene: Scene
  private renderer: Renderer
  public camera: Camera
  public controls: Controller

  constructor() {
    this.scene = new Scene()
    this.renderer = new Renderer()
    this.camera = new Camera()
    this.controls = new Controller(this.camera)

    window.addEventListener('resize', this.handleResizeWindow.bind(this))
  }

  public loop(beforeUpdate: () => void, update: () => void, afterUpdate: () => void): void {
    requestAnimationFrame(this.loop.bind(this, beforeUpdate, update, afterUpdate))
    beforeUpdate()
    update()
    this.render()
    afterUpdate()
  }

  public addChunksToScene(blocks: Chunk['blocks']): void {
    blocks.forEach((block) => {
      if (!block.isDisplayable) return

      const { blockMesh } = block.display(adjustBlockFaces(block, blocks))
      this.scene.add(blockMesh)
    })
  }

  public addLineSegmentBlock(blocks: Chunk['blocks']): void {
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
    this.renderer.setSize(windowSize.width, windowSize.height)
    this.camera.handleResizeWindow()
  }
}

export { Game }
