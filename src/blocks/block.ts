import * as THREE from 'three'

import { BLOCK } from '@src/constant'

interface BlockInterface {
  isDisplayable: boolean
  position: THREE.Vector3
  display(adjustFacesDirection: DirectionName[]): { blockMesh: THREE.Mesh; lineSegment: THREE.LineSegments }
}

const basicMaterial = new THREE.MeshBasicMaterial()
const box = new THREE.BoxBufferGeometry(BLOCK.SIZE, BLOCK.SIZE, BLOCK.SIZE)

abstract class Block implements BlockInterface {
  public isDisplayable = true
  protected texture: BlockTexture[] = []
  public position: THREE.Vector3

  constructor(position: THREE.Vector3, isDisplayable: boolean) {
    this.isDisplayable = isDisplayable
    this.position = position
  }

  public display(adjustFacesDirection: DirectionName[]): { blockMesh: THREE.Mesh; lineSegment: THREE.LineSegments } {
    const materials = this.texture.map((t) => (adjustFacesDirection.includes(t.name) ? basicMaterial : t.material))
    const blockMesh = this.displayBlock(materials)
    const lineSegment = this.displayLine()
    return { blockMesh, lineSegment }
  }

  private displayBlock(materials: THREE.MeshBasicMaterial[]): THREE.Mesh {
    const blockMesh = new THREE.Mesh(box, materials)

    blockMesh.position.x = this.position.x
    blockMesh.position.y = this.position.y - BLOCK.SIZE * 2
    blockMesh.position.z = this.position.z

    return blockMesh
  }

  private displayLine(): THREE.LineSegments {
    const edges = new THREE.EdgesGeometry(box)
    const lineSegment = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x00000 }))

    lineSegment.position.x = this.position.x
    lineSegment.position.y = this.position.y - BLOCK.SIZE * 2
    lineSegment.position.z = this.position.z

    return lineSegment
  }
}

export { BlockInterface, Block }
