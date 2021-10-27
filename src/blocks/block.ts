import * as THREE from 'three'

import { BLOCK } from '@src/constant'
import { DirectionName, BlockTexture } from '@src/assets'

interface BlockInterface {
  isBottom: boolean
  position: THREE.Vector3
  display(adjustFacesDirection: DirectionName[]): { blockMesh: THREE.Mesh; lineSegment: THREE.LineSegments }
}

const basicMaterial = new THREE.MeshBasicMaterial()

abstract class Block implements BlockInterface {
  public isBottom = false
  protected box: THREE.BoxGeometry
  protected texture: BlockTexture[] = []
  public position: THREE.Vector3

  constructor(position: THREE.Vector3, isBottom: boolean) {
    this.isBottom = isBottom
    this.position = position
    this.box = new THREE.BoxBufferGeometry(BLOCK.SIZE, BLOCK.SIZE, BLOCK.SIZE)
  }

  public display(adjustFacesDirection: DirectionName[]): { blockMesh: THREE.Mesh; lineSegment: THREE.LineSegments } {
    const materials = this.texture.map((t) => (adjustFacesDirection.includes(t.name) ? basicMaterial : t.material))
    const blockMesh = this.displayBlock(materials)
    const lineSegment = this.displayLine()
    return { blockMesh, lineSegment }
  }

  private displayBlock(materials: THREE.MeshBasicMaterial[]): THREE.Mesh {
    const blockMesh = new THREE.Mesh(this.box, materials)

    blockMesh.position.x = this.position.x
    blockMesh.position.y = this.position.y - BLOCK.SIZE * 2
    blockMesh.position.z = this.position.z

    return blockMesh
  }

  private displayLine(): THREE.LineSegments {
    const edges = new THREE.EdgesGeometry(this.box)
    const lineSegment = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00000 }))

    lineSegment.position.x = this.position.x
    lineSegment.position.y = this.position.y - BLOCK.SIZE * 2
    lineSegment.position.z = this.position.z

    return lineSegment
  }
}

export { BlockInterface, Block }
