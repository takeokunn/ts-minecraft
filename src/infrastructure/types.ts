import { Effect, Scope } from 'effect'
import { PerspectiveCamera, Scene, WebGLRenderer, Mesh } from 'three'
import { PointerLockControls } from 'three/examples/jsm/controls/PointerLockControls.js'
import Stats from 'three/examples/jsm/libs/stats.module.js'

export interface LockableControls extends EventTarget {
  readonly isLocked: boolean
  readonly lock: () => void
  readonly unlock: () => void
}

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
  readonly instancedMeshes: Map<string, Mesh>
}
