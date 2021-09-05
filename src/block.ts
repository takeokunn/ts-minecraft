import * as THREE from 'three'

import texture from './texture'
import { BLOCK } from './constant'

class Block {
  private box: THREE.BoxGeometry
  public position: THREE.Vector3

  constructor(position: THREE.Vector3) {
    this.position = position
    this.box = new THREE.BoxBufferGeometry(BLOCK.SIZE, BLOCK.SIZE, BLOCK.SIZE)
  }

  display(): { blockMesh: THREE.Mesh; lineSegment: THREE.LineSegments } {
    const blockMesh = this.displayBlock()
    const lineSegment = this.displayLine()
    return { blockMesh, lineSegment }
  }

  private displayBlock(): THREE.Mesh {
    const blockMesh = new THREE.Mesh(this.box, texture.dart)

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

export default Block
