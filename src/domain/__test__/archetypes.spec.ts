import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { ArchetypeBuilder, createArchetype, hasComponents } from '../archetypes'
import {
  Camera,
  CameraState,
  Chunk,
  Collider,
  Gravity,
  Hotbar,
  InputState,
  Player,
  Position,
  Renderable,
  Target,
  TargetBlockComponent,
  TerrainBlock,
  Velocity,
} from '../components'

describe('Archetypes', () => {
  describe('createArchetype', () => {
    it('should create a player archetype', async () => {
      const builder: ArchetypeBuilder = {
        type: 'player',
        pos: new Position({ x: 1, y: 2, z: 3 }),
      }
      const archetype = await Effect.runPromise(createArchetype(builder))
      expect(archetype.player).toBeInstanceOf(Player)
      expect(archetype.position).toEqual(new Position({ x: 1, y: 2, z: 3 }))
      expect(archetype.velocity).toBeInstanceOf(Velocity)
      expect(archetype.gravity).toBeInstanceOf(Gravity)
      expect(archetype.cameraState).toBeInstanceOf(CameraState)
      expect(archetype.inputState).toBeInstanceOf(InputState)
      expect(archetype.collider).toBeInstanceOf(Collider)
      expect(archetype.hotbar).toBeInstanceOf(Hotbar)
      expect(archetype.target).toBeInstanceOf(Object)
    })

    it('should create a block archetype', async () => {
      const builder: ArchetypeBuilder = {
        type: 'block',
        pos: new Position({ x: 4, y: 5, z: 6 }),
        blockType: 'grass',
      }
      const archetype = await Effect.runPromise(createArchetype(builder))
      expect(archetype.position).toEqual(new Position({ x: 4, y: 5, z: 6 }))
      expect(archetype.renderable).toBeInstanceOf(Renderable)
      expect(archetype.collider).toBeInstanceOf(Collider)
      expect(archetype.terrainBlock).toBeInstanceOf(TerrainBlock)
    })

    it('should create a camera archetype', async () => {
      const builder: ArchetypeBuilder = {
        type: 'camera',
        pos: new Position({ x: 7, y: 8, z: 9 }),
      }
      const archetype = await Effect.runPromise(createArchetype(builder))
      expect(archetype.camera).toBeInstanceOf(Camera)
      expect(archetype.position).toEqual(new Position({ x: 7, y: 8, z: 9 }))
    })

    it('should create a target block archetype', async () => {
      const builder: ArchetypeBuilder = {
        type: 'targetBlock',
        pos: new Position({ x: 10, y: 11, z: 12 }),
      }
      const archetype = await Effect.runPromise(createArchetype(builder))
      expect(archetype.position).toEqual(new Position({ x: 10, y: 11, z: 12 }))
      expect(archetype.targetBlock).toBeInstanceOf(TargetBlockComponent)
    })

    it('should create a chunk archetype', async () => {
      const builder: ArchetypeBuilder = {
        type: 'chunk',
        chunkX: 1,
        chunkZ: 2,
      }
      const archetype = await Effect.runPromise(createArchetype(builder))
      expect(archetype.chunk).toBeInstanceOf(Chunk)
    })
  })

  describe('hasComponents', () => {
    const archetype = {
      player: new Player({ isGrounded: false }),
      position: new Position({ x: 1, y: 2, z: 3 }),
      velocity: new Velocity({ dx: 0, dy: 0, dz: 0 }),
    }

    it('should return true if the archetype has all specified components', () => {
      expect(hasComponents(archetype, ['player', 'position'])).toBe(true)
    })

    it('should return false if the archetype is missing one or more specified components', () => {
      expect(hasComponents(archetype, ['player', 'renderable'])).toBe(false)
    })

    it('should return true for an empty component list', () => {
      expect(hasComponents(archetype, [])).toBe(true)
    })

    it('should correctly narrow the type of the archetype', () => {
      if (hasComponents(archetype, ['player', 'position', 'velocity'])) {
        expect(archetype.player).toBeDefined()
        expect(archetype.position).toBeDefined()
        expect(archetype.velocity).toBeDefined()
      } else {
        // This block should not be reached
        expect(true).toBe(false)
      }
    })
  })
})