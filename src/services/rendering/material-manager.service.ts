import { Context, Effect } from 'effect'
import * as THREE from 'three'

/**
 * MaterialManager Service - Manages Three.js materials
 */
export class MaterialManager extends Context.Tag('MaterialManager')<
  MaterialManager,
  {
    readonly getMaterial: (name: string) => Effect.Effect<THREE.Material, never, never>
  }
>() {}