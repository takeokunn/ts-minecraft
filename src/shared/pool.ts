import * as THREE from 'three'

/**
 * Simple object pool for reducing memory allocations
 * Reuses objects instead of creating new ones each frame
 */
export class ObjectPool<T> {
  private pool: T[] = []
  private createFn: () => T

  constructor(createFn: () => T, initialSize = 10) {
    this.createFn = createFn
    for (let i = 0; i < initialSize; i++) {
      this.pool.push(createFn())
    }
  }

  /**
   * Acquire an object from the pool or create a new one
   */
  acquire(): T {
    return this.pool.pop() || this.createFn()
  }

  /**
   * Release an object back to the pool for reuse
   */
  release(obj: T): void {
    this.pool.push(obj)
  }
}

/**
 * Object pools for Three.js types to reduce allocations in rendering loop
 */
export const Vector3Pool = new ObjectPool(() => new THREE.Vector3(), 20)
export const QuaternionPool = new ObjectPool(() => new THREE.Quaternion(), 10)
export const Matrix4Pool = new ObjectPool(() => new THREE.Matrix4(), 5)
