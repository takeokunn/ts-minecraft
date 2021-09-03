import * as THREE from 'three'

import { BLOCK } from './constant'

class Block {
  private position: THREE.Vector3

  private box: THREE.BoxGeometry

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
    const mesh = new THREE.MeshBasicMaterial({ color: 0x00ff00 })
    const blockMesh = new THREE.Mesh(this.box, mesh)

    blockMesh.position.x = this.position.x
    blockMesh.position.y = this.position.y
    blockMesh.position.z = this.position.z

    return blockMesh
  }

  private displayLine(): THREE.LineSegments {
    const edges = new THREE.EdgesGeometry(this.box)
    const lineSegment = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff }))

    lineSegment.position.x = this.position.x
    lineSegment.position.y = this.position.y
    lineSegment.position.z = this.position.z

    return lineSegment
  }
}

export default Block
