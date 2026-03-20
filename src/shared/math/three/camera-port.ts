/**
 * Minimal duck-typed interface for a 3D camera that supports rotation mutation.
 * Satisfied structurally by THREE.PerspectiveCamera and any compatible mock.
 */
export interface CameraRotationPort {
  readonly rotation: {
    set(x: number, y: number, z: number, order?: string): void
  }
}
