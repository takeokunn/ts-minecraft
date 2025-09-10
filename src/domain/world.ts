import { HashMap, HashSet } from 'effect'
import { type ComponentName, type ComponentOfName, ChunkComponent } from '@/core/components'
import { PlacedBlock } from './block'
import { EntityId } from './entity'

// Import errors from centralized location
export { EntityNotFoundError, ComponentNotFoundError } from '@/core/errors'

// --- Data Types ---
export type Voxel = PlacedBlock

export type ComponentStorage = {
  readonly [K in ComponentName]: HashMap.HashMap<EntityId, ComponentOfName<K>>
}

export type ArchetypeStorage = HashMap.HashMap<string, HashSet.HashSet<EntityId>>

export interface WorldState {
  readonly nextEntityId: number
  readonly entities: HashMap.HashMap<EntityId, string> // Map<EntityId, ArchetypeKey>
  readonly archetypes: ArchetypeStorage
  readonly components: ComponentStorage
  readonly chunks: HashMap.HashMap<string, ChunkComponent>
}
