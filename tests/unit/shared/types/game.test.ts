import { describe, it, expect } from 'vitest'
import * as S from 'effect/Schema'
import * as Brand from 'effect/Brand'
import {
  BlockTypeSchema,
  BlockType,
  blockTypeNames,
  WorldPosition,
  ChunkPosition,
  BlockPosition,
  ChunkID,
  ChunkData,
  PlayerID,
  PlayerInput,
  GameMode,
  BiomeType,
  TerrainFeature,
  ItemType,
  ItemStack,
  InventorySlot,
  Inventory,
  Velocity,
  CollisionBox,
  RenderDistance,
  LODLevel,
  MeshData,
  ServerMessage,
  ClientMessage,
  GameMetrics,
  WorldEvent,
  GameState
} from '@shared/types/game'
import { Point3D, ID, JsonValue } from '@shared/types/common'

describe('game types', () => {
  describe('BlockTypeSchema', () => {
    it('should validate all defined block types', () => {
      const validBlockTypes: BlockType[] = [
        'air', 'grass', 'dirt', 'stone', 'cobblestone', 
        'oakLog', 'oakLeaves', 'sand', 'water', 'glass', 
        'brick', 'plank'
      ]
      
      for (const blockType of validBlockTypes) {
        const result = S.decodeUnknownSync(BlockTypeSchema)(blockType)
        expect(result).toBe(blockType)
      }
    })

    it('should reject invalid block types', () => {
      const invalidBlockTypes = [
        'diamond', 'emerald', 'coal', 'iron', 'gold',
        '', null, undefined, 123, {}, []
      ]
      
      for (const blockType of invalidBlockTypes) {
        expect(() => S.decodeUnknownSync(BlockTypeSchema)(blockType)).toThrow()
      }
    })

    it('should match blockTypeNames array', () => {
      expect(blockTypeNames).toHaveLength(12)
      expect(blockTypeNames).toContain('air')
      expect(blockTypeNames).toContain('grass')
      expect(blockTypeNames).toContain('stone')
      expect(blockTypeNames).toContain('water')
      
      // Ensure all blockTypeNames are valid according to schema
      for (const blockType of blockTypeNames) {
        expect(() => S.decodeUnknownSync(BlockTypeSchema)(blockType)).not.toThrow()
      }
    })

    it('should be case-sensitive', () => {
      expect(() => S.decodeUnknownSync(BlockTypeSchema)('Air')).toThrow()
      expect(() => S.decodeUnknownSync(BlockTypeSchema)('GRASS')).toThrow()
      expect(() => S.decodeUnknownSync(BlockTypeSchema)('Stone')).toThrow()
    })
  })

  describe('Position and coordinate types', () => {
    it('should accept valid WorldPosition', () => {
      const validPositions: WorldPosition[] = [
        { x: 0, y: 0, z: 0 },
        { x: 100.5, y: 64, z: -50.25 },
        { x: -1000, y: 256, z: 1000 }
      ]
      
      for (const position of validPositions) {
        expect(position.x).toBeTypeOf('number')
        expect(position.y).toBeTypeOf('number')
        expect(position.z).toBeTypeOf('number')
      }
    })

    it('should accept valid ChunkPosition', () => {
      const validChunkPositions: ChunkPosition[] = [
        { x: 0, z: 0 },
        { x: 15, z: -8 },
        { x: -100, z: 200 }
      ]
      
      for (const position of validChunkPositions) {
        expect(position.x).toBeTypeOf('number')
        expect(position.z).toBeTypeOf('number')
        expect(position).not.toHaveProperty('y') // ChunkPosition should not have y
      }
    })

    it('should accept valid BlockPosition', () => {
      const validBlockPositions: BlockPosition[] = [
        { x: 0, y: 0, z: 0 },
        { x: 16, y: 64, z: 16 },
        { x: -256, y: 128, z: 512 }
      ]
      
      for (const position of validBlockPositions) {
        expect(position.x).toBeTypeOf('number')
        expect(position.y).toBeTypeOf('number')
        expect(position.z).toBeTypeOf('number')
      }
    })
  })

  describe('Chunk-related types', () => {
    it('should create valid ChunkData objects', () => {
      const chunkData: ChunkData = {
        id: 'chunk-1' as ChunkID,
        position: { x: 0, z: 0 },
        blocks: [[[]]],
        isLoaded: true,
        isDirty: false,
        lastAccessed: Date.now()
      }
      
      expect(chunkData.id).toBeTypeOf('string')
      expect(chunkData.position).toEqual({ x: 0, z: 0 })
      expect(Array.isArray(chunkData.blocks)).toBe(true)
      expect(chunkData.isLoaded).toBe(true)
      expect(chunkData.isDirty).toBe(false)
      expect(chunkData.lastAccessed).toBeTypeOf('number')
    })

    it('should support different chunk states', () => {
      const loadedChunk: ChunkData = {
        id: 'loaded-chunk' as ChunkID,
        position: { x: 1, z: 1 },
        blocks: Array(16).fill(0).map(() => 
          Array(256).fill(0).map(() => 
            Array(16).fill('grass' as BlockType)
          )
        ),
        isLoaded: true,
        isDirty: true,
        lastAccessed: Date.now()
      }
      
      const unloadedChunk: ChunkData = {
        id: 'unloaded-chunk' as ChunkID,
        position: { x: -1, z: -1 },
        blocks: [],
        isLoaded: false,
        isDirty: false,
        lastAccessed: Date.now() - 60000 // 1 minute ago
      }
      
      expect(loadedChunk.isLoaded).toBe(true)
      expect(loadedChunk.isDirty).toBe(true)
      expect(loadedChunk.blocks.length).toBe(16)
      
      expect(unloadedChunk.isLoaded).toBe(false)
      expect(unloadedChunk.isDirty).toBe(false)
      expect(unloadedChunk.blocks).toEqual([])
    })
  })

  describe('Player-related types', () => {
    it('should create valid PlayerInput objects', () => {
      const playerInput: PlayerInput = {
        forward: true,
        backward: false,
        left: false,
        right: true,
        jump: false,
        sprint: true,
        sneak: false,
        mouseX: 150.5,
        mouseY: -75.2
      }
      
      expect(playerInput.forward).toBe(true)
      expect(playerInput.backward).toBe(false)
      expect(playerInput.sprint).toBe(true)
      expect(playerInput.mouseX).toBe(150.5)
      expect(playerInput.mouseY).toBe(-75.2)
    })

    it('should handle all input combinations', () => {
      const allFalseInput: PlayerInput = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        jump: false,
        sprint: false,
        sneak: false,
        mouseX: 0,
        mouseY: 0
      }
      
      const allTrueInput: PlayerInput = {
        forward: true,
        backward: true,
        left: true,
        right: true,
        jump: true,
        sprint: true,
        sneak: true,
        mouseX: 1920,
        mouseY: 1080
      }
      
      expect(Object.values(allFalseInput).every(val => 
        typeof val === 'boolean' ? val === false : val === 0
      )).toBe(true)
      
      expect(allTrueInput.forward && allTrueInput.backward).toBe(true) // Can have conflicting inputs
    })
  })

  describe('Game mode types', () => {
    it('should accept all valid game modes', () => {
      const validGameModes: GameMode[] = ['survival', 'creative', 'spectator', 'adventure']
      
      for (const gameMode of validGameModes) {
        expect(['survival', 'creative', 'spectator', 'adventure']).toContain(gameMode)
      }
    })
  })

  describe('World generation types', () => {
    it('should accept all valid biome types', () => {
      const validBiomes: BiomeType[] = ['plains', 'forest', 'desert', 'mountains', 'ocean', 'swamp']
      
      for (const biome of validBiomes) {
        expect(['plains', 'forest', 'desert', 'mountains', 'ocean', 'swamp']).toContain(biome)
      }
    })

    it('should accept all valid terrain features', () => {
      const validFeatures: TerrainFeature[] = ['cave', 'ore_vein', 'water_source', 'lava_source', 'structure']
      
      for (const feature of validFeatures) {
        expect(['cave', 'ore_vein', 'water_source', 'lava_source', 'structure']).toContain(feature)
      }
    })
  })

  describe('Inventory and item types', () => {
    it('should create valid ItemStack objects', () => {
      const itemStack: ItemStack = {
        type: 'grass',
        count: 64,
        metadata: {
          durability: 100,
          enchantments: ['efficiency'],
          customName: 'Super Grass'
        }
      }
      
      expect(itemStack.type).toBe('grass')
      expect(itemStack.count).toBe(64)
      expect(itemStack.metadata).toBeDefined()
      expect(itemStack.metadata?.durability).toBe(100)
    })

    it('should handle ItemStack without metadata', () => {
      const simpleStack: ItemStack = {
        type: 'dirt',
        count: 32
      }
      
      expect(simpleStack.type).toBe('dirt')
      expect(simpleStack.count).toBe(32)
      expect(simpleStack.metadata).toBeUndefined()
    })

    it('should support tool items', () => {
      const toolStack: ItemStack = {
        type: 'tool_pickaxe',
        count: 1,
        metadata: {
          material: 'diamond',
          durability: 1561,
          efficiency: 5
        }
      }
      
      expect(toolStack.type).toBe('tool_pickaxe')
      expect(toolStack.count).toBe(1)
    })

    it('should create valid inventory slots', () => {
      const filledSlot: InventorySlot = {
        type: 'stone',
        count: 16
      }
      
      const emptySlot: InventorySlot = null
      
      expect(filledSlot).not.toBeNull()
      expect(filledSlot?.type).toBe('stone')
      expect(emptySlot).toBeNull()
    })

    it('should create valid inventory arrays', () => {
      const inventory: Inventory = [
        { type: 'grass', count: 64 },
        { type: 'dirt', count: 32 },
        null, // empty slot
        { type: 'tool_pickaxe', count: 1, metadata: { durability: 500 } },
        null,
        { type: 'stone', count: 8 }
      ]
      
      expect(inventory).toHaveLength(6)
      expect(inventory[0]?.type).toBe('grass')
      expect(inventory[2]).toBeNull()
      expect(inventory[3]?.metadata?.durability).toBe(500)
    })
  })

  describe('Physics types', () => {
    it('should create valid Velocity objects', () => {
      const velocity: Velocity = { x: 5.2, y: -9.8, z: 0.1 }
      
      expect(velocity.x).toBe(5.2)
      expect(velocity.y).toBe(-9.8)
      expect(velocity.z).toBe(0.1)
    })

    it('should create valid CollisionBox objects', () => {
      const collisionBox: CollisionBox = {
        min: { x: -0.5, y: 0, z: -0.5 },
        max: { x: 0.5, y: 2, z: 0.5 }
      }
      
      expect(collisionBox.min.x).toBe(-0.5)
      expect(collisionBox.max.y).toBe(2)
    })
  })

  describe('Rendering types', () => {
    it('should support LOD levels', () => {
      const lodLevels: LODLevel[] = [0, 1, 2, 3]
      
      for (const level of lodLevels) {
        expect([0, 1, 2, 3]).toContain(level)
      }
    })

    it('should create valid MeshData objects', () => {
      const meshData: MeshData = {
        vertices: new Float32Array([0, 0, 0, 1, 1, 1]),
        indices: new Uint32Array([0, 1, 2]),
        normals: new Float32Array([0, 1, 0, 0, 1, 0]),
        uvs: new Float32Array([0, 0, 1, 1])
      }
      
      expect(meshData.vertices).toBeInstanceOf(Float32Array)
      expect(meshData.indices).toBeInstanceOf(Uint32Array)
      expect(meshData.normals).toBeInstanceOf(Float32Array)
      expect(meshData.uvs).toBeInstanceOf(Float32Array)
    })

    it('should create MeshData without optional properties', () => {
      const basicMeshData: MeshData = {
        vertices: new Float32Array([0, 0, 0]),
        indices: new Uint32Array([0])
      }
      
      expect(basicMeshData.vertices).toBeInstanceOf(Float32Array)
      expect(basicMeshData.indices).toBeInstanceOf(Uint32Array)
      expect(basicMeshData.normals).toBeUndefined()
      expect(basicMeshData.uvs).toBeUndefined()
    })
  })

  describe('Network message types', () => {
    it('should create valid ServerMessage objects', () => {
      const serverMessage: ServerMessage = {
        type: 'player_position_update',
        data: {
          playerId: 'player-123',
          position: { x: 100, y: 64, z: -50 },
          velocity: { x: 0, y: 0, z: 2.5 }
        },
        timestamp: Date.now()
      }
      
      expect(serverMessage.type).toBe('player_position_update')
      expect(serverMessage.data).toBeDefined()
      expect(serverMessage.timestamp).toBeTypeOf('number')
    })

    it('should create valid ClientMessage objects', () => {
      const clientMessage: ClientMessage = {
        type: 'input_update',
        data: {
          forward: true,
          jump: false,
          mouseX: 25.5,
          mouseY: -10.2
        },
        timestamp: Date.now()
      }
      
      expect(clientMessage.type).toBe('input_update')
      expect(clientMessage.data).toBeDefined()
      expect(clientMessage.timestamp).toBeTypeOf('number')
    })

    it('should support various message data types', () => {
      const messages: ServerMessage[] = [
        {
          type: 'string_data',
          data: 'Hello World',
          timestamp: Date.now()
        },
        {
          type: 'number_data',
          data: 42,
          timestamp: Date.now()
        },
        {
          type: 'array_data',
          data: [1, 2, 3, 'four'],
          timestamp: Date.now()
        },
        {
          type: 'complex_data',
          data: {
            nested: {
              values: [true, false, null],
              count: 100
            }
          },
          timestamp: Date.now()
        }
      ]
      
      for (const message of messages) {
        expect(message.type).toBeTypeOf('string')
        expect(message.data).toBeDefined()
        expect(message.timestamp).toBeTypeOf('number')
      }
    })
  })

  describe('Performance metrics types', () => {
    it('should create valid GameMetrics objects', () => {
      const gameMetrics: GameMetrics = {
        fps: 60,
        frameTime: 16.67,
        chunkUpdates: 5,
        entitiesRendered: 150,
        drawCalls: 25,
        memoryUsage: 512000000,
        networkLatency: 45
      }
      
      expect(gameMetrics.fps).toBe(60)
      expect(gameMetrics.frameTime).toBe(16.67)
      expect(gameMetrics.chunkUpdates).toBe(5)
      expect(gameMetrics.entitiesRendered).toBe(150)
      expect(gameMetrics.drawCalls).toBe(25)
      expect(gameMetrics.memoryUsage).toBe(512000000)
      expect(gameMetrics.networkLatency).toBe(45)
    })

    it('should support GameMetrics without optional properties', () => {
      const basicMetrics: GameMetrics = {
        fps: 30,
        frameTime: 33.33,
        chunkUpdates: 2,
        entitiesRendered: 50,
        drawCalls: 10,
        memoryUsage: 256000000
      }
      
      expect(basicMetrics.networkLatency).toBeUndefined()
      expect(basicMetrics.fps).toBe(30)
    })
  })

  describe('World event types', () => {
    it('should create valid block placement events', () => {
      const blockPlacedEvent: WorldEvent = {
        type: 'block_placed',
        position: { x: 10, y: 64, z: 5 },
        blockType: 'stone'
      }
      
      expect(blockPlacedEvent.type).toBe('block_placed')
      expect(blockPlacedEvent.position).toEqual({ x: 10, y: 64, z: 5 })
      expect(blockPlacedEvent.blockType).toBe('stone')
    })

    it('should create valid block destruction events', () => {
      const blockDestroyedEvent: WorldEvent = {
        type: 'block_destroyed',
        position: { x: 0, y: 63, z: 0 },
        blockType: 'grass'
      }
      
      expect(blockDestroyedEvent.type).toBe('block_destroyed')
      expect(blockDestroyedEvent.position).toEqual({ x: 0, y: 63, z: 0 })
      expect(blockDestroyedEvent.blockType).toBe('grass')
    })

    it('should create valid chunk events', () => {
      const chunkLoadedEvent: WorldEvent = {
        type: 'chunk_loaded',
        chunkId: 'chunk-0-0' as ChunkID
      }
      
      const chunkUnloadedEvent: WorldEvent = {
        type: 'chunk_unloaded',
        chunkId: 'chunk-5-5' as ChunkID
      }
      
      expect(chunkLoadedEvent.type).toBe('chunk_loaded')
      expect(chunkLoadedEvent.chunkId).toBe('chunk-0-0')
      expect(chunkUnloadedEvent.type).toBe('chunk_unloaded')
      expect(chunkUnloadedEvent.chunkId).toBe('chunk-5-5')
    })

    it('should create valid player movement events', () => {
      const playerMovedEvent: WorldEvent = {
        type: 'player_moved',
        playerId: 'player-abc123' as PlayerID,
        position: { x: 25.5, y: 64.1, z: -10.2 }
      }
      
      expect(playerMovedEvent.type).toBe('player_moved')
      expect(playerMovedEvent.playerId).toBe('player-abc123')
      expect(playerMovedEvent.position).toEqual({ x: 25.5, y: 64.1, z: -10.2 })
    })

    it('should ensure event type safety', () => {
      // This test ensures that WorldEvent discriminated union works correctly
      const events: WorldEvent[] = [
        { type: 'block_placed', position: { x: 0, y: 0, z: 0 }, blockType: 'dirt' },
        { type: 'block_destroyed', position: { x: 1, y: 1, z: 1 }, blockType: 'stone' },
        { type: 'chunk_loaded', chunkId: 'chunk-1' as ChunkID },
        { type: 'chunk_unloaded', chunkId: 'chunk-2' as ChunkID },
        { type: 'player_moved', playerId: 'player-1' as PlayerID, position: { x: 2, y: 2, z: 2 } }
      ]
      
      for (const event of events) {
        expect(event.type).toBeTypeOf('string')
        
        switch (event.type) {
          case 'block_placed':
          case 'block_destroyed':
            expect(event.position).toBeDefined()
            expect(event.blockType).toBeDefined()
            break
          case 'chunk_loaded':
          case 'chunk_unloaded':
            expect(event.chunkId).toBeDefined()
            break
          case 'player_moved':
            expect(event.playerId).toBeDefined()
            expect(event.position).toBeDefined()
            break
        }
      }
    })
  })

  describe('Game state types', () => {
    it('should create valid GameState objects', () => {
      const gameState: GameState = {
        gameMode: 'survival',
        worldSeed: 12345,
        dayTime: 6000, // noon
        weather: 'clear',
        difficulty: 'normal'
      }
      
      expect(gameState.gameMode).toBe('survival')
      expect(gameState.worldSeed).toBe(12345)
      expect(gameState.dayTime).toBe(6000)
      expect(gameState.weather).toBe('clear')
      expect(gameState.difficulty).toBe('normal')
    })

    it('should support all game modes', () => {
      const gameModes: GameMode[] = ['survival', 'creative', 'spectator', 'adventure']
      
      for (const mode of gameModes) {
        const gameState: GameState = {
          gameMode: mode,
          worldSeed: 0,
          dayTime: 0,
          weather: 'clear',
          difficulty: 'peaceful'
        }
        
        expect(gameState.gameMode).toBe(mode)
      }
    })

    it('should support all weather types', () => {
      const weatherTypes = ['clear', 'rain', 'storm'] as const
      
      for (const weather of weatherTypes) {
        const gameState: GameState = {
          gameMode: 'survival',
          worldSeed: 0,
          dayTime: 0,
          weather,
          difficulty: 'peaceful'
        }
        
        expect(gameState.weather).toBe(weather)
      }
    })

    it('should support all difficulty levels', () => {
      const difficulties = ['peaceful', 'easy', 'normal', 'hard'] as const
      
      for (const difficulty of difficulties) {
        const gameState: GameState = {
          gameMode: 'survival',
          worldSeed: 0,
          dayTime: 0,
          weather: 'clear',
          difficulty
        }
        
        expect(gameState.difficulty).toBe(difficulty)
      }
    })
  })

  describe('Type relationships and consistency', () => {
    it('should maintain consistency between related types', () => {
      // Ensure all BlockType values can be used in ItemType
      const blockAsItem: ItemType = 'grass' // Should work
      expect(['grass', 'dirt', 'stone', 'cobblestone', 'oakLog', 'oakLeaves', 'sand', 'water', 'glass', 'brick', 'plank']).toContain(blockAsItem)
    })

    it('should support proper ID branding', () => {
      const chunkId: ChunkID = 'chunk-unique-id' as ChunkID
      const playerId: PlayerID = 'player-unique-id' as PlayerID
      
      expect(typeof chunkId).toBe('string')
      expect(typeof playerId).toBe('string')
    })

    it('should ensure position types are interchangeable where appropriate', () => {
      const point3D: Point3D = { x: 1, y: 2, z: 3 }
      const worldPosition: WorldPosition = point3D // Should be assignable
      const blockPosition: BlockPosition = point3D // Should be assignable
      const velocity: Velocity = point3D // Should be assignable (same structure)
      
      expect(worldPosition).toEqual(point3D)
      expect(blockPosition).toEqual(point3D)
      expect(velocity).toEqual(point3D)
    })

    it('should maintain type safety with branded types', () => {
      // These should be distinct types even though they're all strings
      const chunkId = 'chunk-1' as ChunkID
      const playerId = 'player-1' as PlayerID
      
      // At runtime they're both strings
      expect(typeof chunkId).toBe('string')
      expect(typeof playerId).toBe('string')
      
      // But TypeScript should treat them as distinct types
      expect(chunkId).toBe('chunk-1')
      expect(playerId).toBe('player-1')
    })
  })

  describe('Complex data structure validation', () => {
    it('should handle nested game data structures', () => {
      const complexGameData = {
        chunk: {
          id: 'chunk-complex' as ChunkID,
          position: { x: 5, z: -3 },
          blocks: Array(16).fill(0).map(() =>
            Array(256).fill(0).map(() =>
              Array(16).fill('air' as BlockType)
            )
          ),
          isLoaded: true,
          isDirty: false,
          lastAccessed: Date.now()
        } as ChunkData,
        player: {
          id: 'player-complex' as PlayerID,
          inventory: [
            { type: 'grass' as BlockType, count: 64 },
            { type: 'tool_pickaxe' as ItemType, count: 1, metadata: { durability: 1000 } },
            null,
            { type: 'stone' as BlockType, count: 32 }
          ] as Inventory,
          input: {
            forward: true,
            backward: false,
            left: false,
            right: true,
            jump: true,
            sprint: false,
            sneak: false,
            mouseX: 0,
            mouseY: 0
          } as PlayerInput
        },
        world: {
          events: [
            {
              type: 'block_placed' as const,
              position: { x: 10, y: 64, z: 5 },
              blockType: 'stone' as BlockType
            },
            {
              type: 'player_moved' as const,
              playerId: 'player-complex' as PlayerID,
              position: { x: 12, y: 64, z: 6 }
            }
          ] as WorldEvent[],
          state: {
            gameMode: 'creative' as GameMode,
            worldSeed: 987654321,
            dayTime: 12000,
            weather: 'rain' as const,
            difficulty: 'hard' as const
          } as GameState
        }
      }
      
      expect(complexGameData.chunk.id).toBe('chunk-complex')
      expect(complexGameData.chunk.blocks.length).toBe(16)
      expect(complexGameData.player.inventory).toHaveLength(4)
      expect(complexGameData.player.input.forward).toBe(true)
      expect(complexGameData.world.events).toHaveLength(2)
      expect(complexGameData.world.state.gameMode).toBe('creative')
    })

    it('should validate realistic game scenarios', () => {
      // Simulate a mining scenario
      const miningScenario = {
        playerPosition: { x: 128.5, y: 32, z: 256.75 } as WorldPosition,
        targetBlock: { x: 129, y: 32, z: 257 } as BlockPosition,
        blockType: 'stone' as BlockType,
        tool: {
          type: 'tool_pickaxe' as ItemType,
          count: 1,
          metadata: { durability: 1500, material: 'iron', efficiency: 3 }
        } as ItemStack,
        chunkAffected: 'chunk-8-16' as ChunkID,
        worldEvent: {
          type: 'block_destroyed' as const,
          position: { x: 129, y: 32, z: 257 },
          blockType: 'stone' as BlockType
        } as WorldEvent
      }
      
      expect(miningScenario.playerPosition.x).toBe(128.5)
      expect(miningScenario.targetBlock.y).toBe(32)
      expect(miningScenario.blockType).toBe('stone')
      expect(miningScenario.tool.metadata?.durability).toBe(1500)
      expect(miningScenario.worldEvent.type).toBe('block_destroyed')
    })
  })
})