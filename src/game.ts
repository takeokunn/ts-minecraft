import { Chunk } from '@src/chunk'
import { Scene } from '@src/scene'
import { Block } from '@src/blocks'
import { windowSize } from '@src/assets'
import { Renderer } from '@src/renderer'
import { adjustBlockFaces } from '@src/utils'
import { Controller } from '@src/controller'

interface GameInterface {
  controls: Controller

  loop: (beforeUpdate: () => void, update: () => void, afterUpdate: () => void) => void

  addChunksToScene: (chunks: Chunk[], isShowLineSegment: boolean) => void
  addLineSegmentBlock: (blocks: Chunk['blocks']) => void
  removeLineSegmentBlock: () => void
}

class Game implements GameInterface {
  private scene: Scene
  private renderer: Renderer
  public controls: Controller

  private renderedChunkIds: Chunk['id'][] = []

  constructor() {
    this.scene = new Scene()
    this.renderer = new Renderer()
    this.controls = new Controller()

    window.addEventListener('resize', this.handleResizeWindow.bind(this))
  }

  public loop(beforeUpdate: () => void, update: () => void, afterUpdate: () => void): void {
    requestAnimationFrame(this.loop.bind(this, beforeUpdate, update, afterUpdate))
    beforeUpdate()
    update()
    this.render()
    afterUpdate()
  }

  public addChunksToScene(chunks: Chunk[], isShowLineSegment: boolean): void {
    const blocks = chunks.map((chunk: Chunk) => chunk.blocks).flat()

    chunks
      .filter((chunk: Chunk) => !this.renderedChunkIds.some((id: string) => chunk.id === id))
      .map((chunk: Chunk) => chunk.blocks)
      .flat()
      .forEach((block: Block) => {
        if (!block.isDisplayable) return

        const { blockMesh, lineSegment } = block.display(adjustBlockFaces(block, blocks))
        this.scene.add(blockMesh)
        if (isShowLineSegment) this.scene.add(lineSegment)
      })

    this.renderedChunkIds = chunks.map((chunk: Chunk) => chunk.id)
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
    this.renderer.render(this.scene, this.controls.perspective)
  }

  private handleResizeWindow(): void {
    this.renderer.setSize(windowSize.width, windowSize.height)
    this.controls.handleResizeWindow()
  }
}

export { Game }
