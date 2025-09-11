/**
 * Material Manager Adapter
 * 
 * Infrastructure adapter that provides concrete Three.js material management.
 * This adapter handles the technical aspects of material creation, caching,
 * and disposal using Three.js APIs.
 */

import { Effect, Layer, Context, Ref } from 'effect'
import { IMaterialManager, MaterialManagerPort } from '@domain/ports/material-manager.port'
import * as THREE from 'three'

/**
 * Three.js Material Manager Adapter
 */
export const createMaterialManagerAdapter = () => Effect.gen(function* () {
  const materialsRef = yield* Ref.make<Map<string, THREE.Material>>(new Map())

  /**
   * Create default material based on name
   */
  const createDefaultMaterial = (name: string): Effect.Effect<THREE.Material, Error, never> =>
    Effect.gen(function* () {
      switch (name) {
        case 'chunk':
          return new THREE.MeshStandardMaterial({
            vertexColors: true,
            metalness: 0,
            roughness: 1,
          })
        case 'water':
          return new THREE.MeshStandardMaterial({
            color: 0x006994,
            transparent: true,
            opacity: 0.8,
          })
        case 'grass':
          return new THREE.MeshStandardMaterial({
            color: 0x4a5d23,
          })
        default:
          return new THREE.MeshStandardMaterial({
            color: 0xcccccc,
          })
      }
    })

  return {
    /**
     * Get or create a material by name
     */
    getMaterial: (name: string): Effect.Effect<THREE.Material, Error, never> =>
      Effect.gen(function* () {
        const materials = yield* Ref.get(materialsRef)
        const existing = materials.get(name)
        if (existing) {
          return existing
        }

        // Create default materials based on name
        const material = yield* createDefaultMaterial(name)
        yield* Ref.update(materialsRef, materials => {
          const newMaterials = new Map(materials)
          newMaterials.set(name, material)
          return newMaterials
        })
        return material
      }),

    /**
     * Create material with specific configuration
     */
    createMaterial: (name: string, config: any): Effect.Effect<THREE.Material, Error, never> =>
      Effect.gen(function* () {
        let material: THREE.Material

        switch (config.type || 'standard') {
          case 'basic':
            material = new THREE.MeshBasicMaterial(config)
            break
          case 'standard':
            material = new THREE.MeshStandardMaterial(config)
            break
          case 'physical':
            material = new THREE.MeshPhysicalMaterial(config)
            break
          default:
            material = new THREE.MeshStandardMaterial(config)
        }

        yield* Ref.update(materialsRef, materials => {
          const newMaterials = new Map(materials)
          newMaterials.set(name, material)
          return newMaterials
        })
        return material
      }),

    /**
     * Dispose all materials
     */
    disposeMaterials: (): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        const materials = yield* Ref.get(materialsRef)
        for (const material of materials.values()) {
          material.dispose()
        }
        yield* Ref.set(materialsRef, new Map())
      }),

    /**
     * Check if material exists
     */
    hasMaterial: (name: string): Effect.Effect<boolean, never, never> =>
      Ref.get(materialsRef).pipe(
        Effect.map(materials => materials.has(name))
      ),

    /**
     * Remove specific material
     */
    removeMaterial: (name: string): Effect.Effect<void, never, never> =>
      Effect.gen(function* () {
        const materials = yield* Ref.get(materialsRef)
        const material = materials.get(name)
        if (material) {
          material.dispose()
          yield* Ref.update(materialsRef, materials => {
            const newMaterials = new Map(materials)
            newMaterials.delete(name)
            return newMaterials
          })
        }
      }),

    isAvailable: (): Effect.Effect<boolean, never, never> =>
      Effect.succeed(typeof THREE !== 'undefined')
  } satisfies IMaterialManager
})

/**
 * Live layer for Material Manager Adapter
 */
export const MaterialManagerAdapterLive = Layer.effect(
  MaterialManagerPort,
  createMaterialManagerAdapter()
)

/**
 * Material Manager Adapter utilities
 */
export const MaterialManagerAdapterUtils = {
  /**
   * Validate Three.js capabilities
   */
  validateCapabilities: (): Effect.Effect<boolean, never, never> =>
    Effect.gen(function* () {
      return typeof THREE !== 'undefined' && typeof THREE.Material !== 'undefined'
    }),

  /**
   * Estimate memory usage
   */
  estimateMemoryUsage: (materialCount: number): number => {
    // Rough estimate: each material uses ~1KB
    return materialCount * 1024
  },
}
