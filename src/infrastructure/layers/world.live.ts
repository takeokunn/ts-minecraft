import { Layer, Effect, Ref, Option } from 'effect'
import * as HashMap from 'effect/HashMap'
import { WorldService } from '@/application/services/world.service'
import { WorldState } from '@/domain/world'
import { EntityId, toEntityId } from '@/domain/entities'
import { Archetype } from '@/domain/archetypes'
import { ComponentName, ComponentOfName } from '@/domain/entities/components'
import { ChunkCoordinates, ChunkData } from '@/domain/chunk'
import { BlockType } from '@/domain/value-objects/block-type.vo'
import { ComponentNotFoundError } from '@/domain/errors'

/**
 * Production implementation of World service
 */
export const WorldLive = Layer.effect(
  WorldService,
  Effect.gen(function* () {
    // Initialize world state
    const initialState: WorldState = {
      nextEntityId: 1,
      entities: HashMap.empty(),
      archetypes: HashMap.empty(),
      components: {
        position: HashMap.empty(),
        velocity: HashMap.empty(),
        player: HashMap.empty(),
        inputState: HashMap.empty(),
        cameraState: HashMap.empty(),
        hotbar: HashMap.empty(),
        target: HashMap.empty(),
        gravity: HashMap.empty(),
        collider: HashMap.empty(),
        renderable: HashMap.empty(),
        instancedMeshRenderable: HashMap.empty(),
        terrainBlock: HashMap.empty(),
        chunk: HashMap.empty(),
        camera: HashMap.empty(),
        targetBlock: HashMap.empty(),
        chunkLoaderState: HashMap.empty(),
      },
      chunks: HashMap.empty()
    }
    
    const state = yield* Ref.make(initialState)
    
    return World.of({
      state,
      
      addArchetype: (archetype: Archetype) =>
        Ref.modify(state, (s) => {
          const entityId = toEntityId(s.nextEntityId)
          let newState = {
            ...s,
            nextEntityId: s.nextEntityId + 1,
            entities: HashMap.set(s.entities, entityId, archetype.name || 'unknown')
          }
          
          // Add components for the entity
          Object.entries(archetype.components).forEach(([name, component]) => {
            const componentName = name as ComponentName
            if (component && s.components[componentName]) {
              newState = {
                ...newState,
                components: {
                  ...newState.components,
                  [componentName]: HashMap.set(
                    newState.components[componentName],
                    entityId,
                    component as unknown
                  )
                }
              }
            }
          })
          
          return [entityId, newState] as const
        }),
      
      removeEntity: (entityId: EntityId) =>
        Ref.modify(state, (s) => {
          let newState = {
            ...s,
            entities: HashMap.remove(s.entities, entityId)
          }
          
          // Remove all components for this entity
          Object.keys(s.components).forEach((name) => {
            const componentName = name as ComponentName
            newState = {
              ...newState,
              components: {
                ...newState.components,
                [componentName]: HashMap.remove(
                  newState.components[componentName],
                  entityId
                )
              }
            }
          })
          
          return [undefined, newState] as const
        }),
      
      getComponent: <K extends ComponentName>(
        entityId: EntityId,
        componentName: K
      ) =>
        Ref.get(state).pipe(
          Effect.map((s) =>
            HashMap.get(s.components[componentName], entityId)
          )
        ),
      
      getComponentUnsafe: <K extends ComponentName>(
        entityId: EntityId,
        componentName: K
      ) =>
        Ref.get(state).pipe(
          Effect.flatMap((s) => {
            const component = HashMap.get(s.components[componentName], entityId)
            return Option.isSome(component)
              ? Effect.succeed(component.value)
              : Effect.fail(new ComponentNotFoundError(entityId, componentName))
          })
        ),
      
      updateComponent: <K extends ComponentName>(
        entityId: EntityId,
        componentName: K,
        data: Partial<ComponentOfName<K>>
      ) =>
        Ref.modify(state, (s) => {
          const current = HashMap.get(s.components[componentName], entityId)
          if (Option.isNone(current)) {
            return [undefined, s] as const
          }
          
          const updated = { ...current.value, ...data }
          const newComponentMap = HashMap.set(
            s.components[componentName],
            entityId,
            updated as unknown
          )
          const newComponents = {
            ...s.components,
            [componentName]: newComponentMap
          }
          const newState = { ...s, components: newComponents }
          
          return [undefined, newState] as const
        }),
      
      query: <K extends ComponentName>(
        ...componentNames: K[]
      ) =>
        Ref.get(state).pipe(
          Effect.map((s) => {
            const results: Array<{ entityId: EntityId; components: any }> = []
            
            // Get all entities that have all requested components
            HashMap.forEach(s.entities, (_, entityId) => {
              const components: any = {}
              let hasAll = true
              
              for (const name of componentNames) {
                const component = HashMap.get(s.components[name], entityId)
                if (Option.isNone(component)) {
                  hasAll = false
                  break
                }
                components[name] = component.value
              }
              
              if (hasAll) {
                results.push({ entityId, components })
              }
            })
            
            return results
          })
        ),
      
      querySoA: <K extends ComponentName>(
        ...componentNames: K[]
      ) =>
        Ref.get(state).pipe(
          Effect.map((s) => {
            const entities: EntityId[] = []
            const components: any = {}
            
            // Initialize component arrays
            componentNames.forEach(name => {
              components[name] = []
            })
            
            // Get all entities that have all requested components
            HashMap.forEach(s.entities, (_, entityId) => {
              const entityComponents: any = {}
              let hasAll = true
              
              for (const name of componentNames) {
                const component = HashMap.get(s.components[name], entityId)
                if (Option.isNone(component)) {
                  hasAll = false
                  break
                }
                entityComponents[name] = component.value
              }
              
              if (hasAll) {
                entities.push(entityId)
                componentNames.forEach(name => {
                  components[name].push(entityComponents[name])
                })
              }
            })
            
            return { entities, components }
          })
        ),
      
      queryUnsafe: <K extends ComponentName>(
        ...componentNames: K[]
      ) =>
        Ref.get(state).pipe(
          Effect.map((s) => {
            const results: Array<{ entityId: EntityId; components: any }> = []
            
            HashMap.forEach(s.entities, (_, entityId) => {
              const components: any = {}
              let hasAll = true
              
              for (const name of componentNames) {
                const component = HashMap.get(s.components[name], entityId)
                if (Option.isNone(component)) {
                  hasAll = false
                  break
                }
                components[name] = component.value
              }
              
              if (hasAll) {
                results.push({ entityId, components })
              }
            })
            
            return results
          })
        ),
      
      querySingle: <K extends ComponentName>(
        ...componentNames: K[]
      ) =>
        Ref.get(state).pipe(
          Effect.map((s) => {
            let result: { entityId: EntityId; components: any } | null = null
            
            HashMap.forEach(s.entities, (_, entityId) => {
              if (result) return // Already found one
              
              const components: any = {}
              let hasAll = true
              
              for (const name of componentNames) {
                const component = HashMap.get(s.components[name], entityId)
                if (Option.isNone(component)) {
                  hasAll = false
                  break
                }
                components[name] = component.value
              }
              
              if (hasAll) {
                result = { entityId, components }
              }
            })
            
            return Option.fromNullable(result)
          })
        ),
      
      querySingleUnsafe: <K extends ComponentName>(
        ...componentNames: K[]
      ) =>
        Ref.get(state).pipe(
          Effect.flatMap((s) => {
            let result: { entityId: EntityId; components: any } | null = null
            
            HashMap.forEach(s.entities, (_, entityId) => {
              if (result) return
              
              const components: any = {}
              let hasAll = true
              
              for (const name of componentNames) {
                const component = HashMap.get(s.components[name], entityId)
                if (Option.isNone(component)) {
                  hasAll = false
                  break
                }
                components[name] = component.value
              }
              
              if (hasAll) {
                result = { entityId, components }
              }
            })
            
            return result
              ? Effect.succeed(result)
              : Effect.fail(new Error('No entity found with requested components'))
          })
        ),
      
      getChunk: (coords: ChunkCoordinates) =>
        Ref.get(state).pipe(
          Effect.map((s) => {
            const key = `${coords.x},${coords.z}`
            return HashMap.get(s.chunks, key)
          })
        ),
      
      setChunk: (coords: ChunkCoordinates, chunk: ChunkData) =>
        Ref.modify(state, (s) => {
          const key = `${coords.x},${coords.z}`
          const newChunks = HashMap.set(s.chunks, key, chunk)
          const newState = { ...s, chunks: newChunks }
          return [undefined, newState] as const
        }),
      
      getVoxel: (x: number, y: number, z: number) =>
        Ref.get(state).pipe(
          Effect.map((s) => {
            const chunkX = Math.floor(x / 16)
            const chunkZ = Math.floor(z / 16)
            const key = `${chunkX},${chunkZ}`
            
            const chunk = HashMap.get(s.chunks, key)
            if (Option.isNone(chunk)) {
              return Option.none()
            }
            
            const localX = ((x % 16) + 16) % 16
            const localZ = ((z % 16) + 16) % 16
            const index = localX + localZ * 16 + y * 16 * 16
            
            return Option.fromNullable(chunk.value.voxels[index])
          })
        ),
      
      setVoxel: (x: number, y: number, z: number, blockType: BlockType) =>
        Ref.modify(state, (s) => {
          const chunkX = Math.floor(x / 16)
          const chunkZ = Math.floor(z / 16)
          const key = `${chunkX},${chunkZ}`
          
          const chunk = HashMap.get(s.chunks, key)
          if (Option.isNone(chunk)) {
            return [undefined, s] as const
          }
          
          const localX = ((x % 16) + 16) % 16
          const localZ = ((z % 16) + 16) % 16
          const index = localX + localZ * 16 + y * 16 * 16
          
          const newVoxels = [...chunk.value.voxels]
          newVoxels[index] = blockType
          
          const newChunk = { ...chunk.value, voxels: newVoxels }
          const newChunks = HashMap.set(s.chunks, key, newChunk)
          const newState = { ...s, chunks: newChunks }
          
          return [undefined, newState] as const
        })
    })
  })
)