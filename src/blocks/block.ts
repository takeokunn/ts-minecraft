import { Vector3, Mesh, LineSegments, MeshBasicMaterial, BoxGeometry, EdgesGeometry, LineBasicMaterial } from 'three'

import { BLOCK } from '@src/constant'
import { color } from '@src/assets'

interface BlockInterface {
  isDisplayable: boolean
  position: Vector3
  chunkId: string

  display(adjustFacesDirection: DirectionName[]): { blockMesh: Mesh; lineSegment: LineSegments }
}

const basicMaterial = new MeshBasicMaterial()
const box = new BoxGeometry(BLOCK.SIZE, BLOCK.SIZE, BLOCK.SIZE)

abstract class Block implements BlockInterface {
  protected texture: BlockTexture[] = []

  public position: Vector3
  public isDisplayable = true
  public chunkId: string

  constructor(position: Vector3, isDisplayable: boolean, chunkId: string) {
    this.position = position
    this.isDisplayable = isDisplayable
    this.chunkId = chunkId
  }

  public display(adjustFacesDirection: DirectionName[]): { blockMesh: Mesh; lineSegment: LineSegments } {
    const materials = this.texture.map((t) => (adjustFacesDirection.includes(t.name) ? basicMaterial : t.material))
    const blockMesh = this.displayBlock(materials)
    const lineSegment = this.displayLine()
    return { blockMesh, lineSegment }
  }

  private displayBlock(materials: THREE.MeshBasicMaterial[]): Mesh {
    const blockMesh = new Mesh(box, materials)

    blockMesh.position.x = this.position.x
    blockMesh.position.y = this.position.y - BLOCK.SIZE * 2
    blockMesh.position.z = this.position.z

    return blockMesh
  }

  private displayLine(): LineSegments {
    const edges = new EdgesGeometry(box)
    const lineSegment = new LineSegments(edges, new LineBasicMaterial({ color: color.black }))

    lineSegment.position.x = this.position.x
    lineSegment.position.y = this.position.y - BLOCK.SIZE * 2
    lineSegment.position.z = this.position.z

    return lineSegment
  }
}

export { Block }
