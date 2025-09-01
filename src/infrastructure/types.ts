import type { InstancedMesh, Mesh, PerspectiveCamera, Scene, WebGLRenderer } from 'three'
import type { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import type Stats from 'three/examples/jsm/libs/stats.module.js'

export type ThreeCamera = {
  readonly camera: PerspectiveCamera
  readonly controls: PointerLockControls
}

export type ThreeContext = {
  readonly scene: Scene
  readonly camera: ThreeCamera
  readonly renderer: WebGLRenderer
  readonly highlightMesh: Mesh
  readonly stats: Stats
  readonly chunkMeshes: Map<string, Mesh>
  readonly instancedMeshes: Map<string, InstancedMesh>
}