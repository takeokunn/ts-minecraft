/**
 * Test Pattern Examples - Comprehensive demonstrations
 * 
 * This file demonstrates the new testing infrastructure with real examples
 * showing different testing patterns and best practices.
 */

import { it, expect } from '@effect/vitest'
import { Effect, pipe } from 'effect'
import * as fc from 'effect/FastCheck'
import {
  TestHarness,
  TestPatterns,
  QuickTest,
  TestAssert,
  entityBuilder,
  worldBuilder,
  scenarioBuilder,
  ScenarioTemplates,
  PlayerFixtures,
  BlockFixtures,
  AdvancedEntityArbs,
  ScenarioArbs,
  MockFactory,
  MockAssert,
  ComponentComposer,
  PositionBuilder,
  VelocityBuilder,
  InputStateBuilder
} from '@/test-utils'
import { World } from '@/services/world'
import { BlockType } from '@/domain/block-types'

/**
 * Example 1: Basic Entity Builder Pattern
 */
it.effect('should create player entity with builder pattern', () => {
  const player = pipe(
    entityBuilder.create(),
    entityBuilder.withPosition(0, 64, 0),
    entityBuilder.withVelocity(0, 0, 0),
    entityBuilder.asPlayer(true),
    entityBuilder.withCollider(0.6, 1.8, 0.6),
    entityBuilder.withInputState({ forward: true, sprint: true }),
    entityBuilder.withCameraState(0, 0),
    entityBuilder.withHotbar([BlockType.STONE, BlockType.WOOD], 0),
    entityBuilder.build
  )

  TestAssert.hasComponents(
    player,
    'position',
    'velocity', 
    'player',
    'collider',
    'inputState',
    'cameraState',
    'hotbar'
  )

  expect(player.components.position).toEqual({ x: 0, y: 64, z: 0 })
  expect(player.components.player.isGrounded).toBe(true)
  expect(player.components.inputState.forward).toBe(true)
  expect(player.components.inputState.sprint).toBe(true)

  return Effect.succeed(undefined)
})

/**
 * Example 2: World Builder with Multiple Entities
 */
it.effect('should create world with multiple entities', () => {
  const harness = TestHarness.create()
  
  const worldState = pipe(
    worldBuilder.create(),
    worldBuilder.withPlayer({ x: 0, y: 64, z: 0 }),
    worldBuilder.withBlock({ x: 1, y: 63, z: 0 }, BlockType.STONE),
    worldBuilder.withBlock({ x: -1, y: 63, z: 0 }, BlockType.GRASS),
    worldBuilder.withBlockGrid({ x: -5, y: 62, z: -5 }, 10, 10, BlockType.DIRT)
  )

  return harness.runEffect(
    Effect.gen(function* () {
      const world = yield* World
      yield* worldBuilder.build(worldState)
      
      // Verify entities were added
      const entities = yield* world.query([])
      expect(entities.length).toBeGreaterThan(100) // 1 player + 2 blocks + 100 grid blocks
    })
  )
})

/**
 * Example 3: Component Builder Pattern
 */
it.effect('should compose components using component builder', () => {
  const position = pipe(
    PositionBuilder.create(),
    PositionBuilder.at(10, 65, -5),
    PositionBuilder.build
  )

  const velocity = pipe(
    VelocityBuilder.create(),
    VelocityBuilder.moving(0, 0, 5),
    VelocityBuilder.build
  )

  const input = pipe(
    InputStateBuilder.create(),
    InputStateBuilder.sprinting(),
    InputStateBuilder.build
  )

  const entity = ComponentComposer.compose({
    position,
    velocity,
    inputState: input,
    player: { isGrounded: true },
    collider: { width: 0.6, height: 1.8, depth: 0.6 }
  })

  const validation = ComponentComposer.validate(entity.components)
  expect(validation.valid).toBe(true)
  expect(validation.errors).toEqual([])

  return Effect.succeed(undefined)
})

/**
 * Example 4: Scenario Builder for Complex Tests
 */
it.effect('should handle block breaking scenario', () => {
  const scenario = pipe(
    ScenarioTemplates.blockBreaking(),
    scenarioBuilder.buildWithMetadata
  )

  const harness = TestHarness.create()

  return harness.runEffect(
    Effect.gen(function* () {
      // Setup the scenario
      yield* scenario.setupEffect
      
      const world = yield* World
      const entities = yield* world.query([])
      
      // Should have player + target block
      expect(entities.length).toBeGreaterThanOrEqual(2)
      
      // Verify expected outcomes are defined
      expect(scenario.expectedOutcomes).toContain('Block should be removed from world')
      expect(scenario.expectedOutcomes).toContain('Player inventory should contain stone block')
    })
  )
})

/**
 * Example 5: Fixture-Based Testing
 */
it.effect('should use predefined fixtures', () => {
  const harness = TestHarness.create()
  
  return harness.runEffect(
    Effect.gen(function* () {
      const world = yield* World
      
      // Use predefined player fixtures
      const defaultPlayer = PlayerFixtures.default()
      const fallingPlayer = PlayerFixtures.falling()
      const runningPlayer = PlayerFixtures.running()
      
      yield* world.addArchetype(defaultPlayer)
      yield* world.addArchetype(fallingPlayer)
      yield* world.addArchetype(runningPlayer)
      
      // Add some terrain blocks
      const stoneBlock = BlockFixtures.stone({ x: 0, y: 63, z: 0 })
      const grassBlock = BlockFixtures.grass({ x: 1, y: 63, z: 0 })
      
      yield* world.addArchetype(stoneBlock)
      yield* world.addArchetype(grassBlock)
      
      const entities = yield* world.query([])
      expect(entities.length).toBe(5) // 3 players + 2 blocks
    })
  )
})

/**
 * Example 6: Property-Based Testing with Arbitraries
 */
it.effect('should validate player entities with property-based testing', () => {
  const harness = TestHarness.create()
  
  return harness.runProperty(
    AdvancedEntityArbs.completePlayer,
    (playerArchetype) =>
      Effect.gen(function* () {
        const world = yield* World
        
        // Should be able to add any valid player to world
        const entityId = yield* world.addArchetype(playerArchetype)
        
        // Should be able to retrieve the entity
        const retrievedPlayer = yield* world.getComponent(entityId, 'player')
        expect(retrievedPlayer._tag).toBe('Some')
        
        // Position should be valid
        const position = yield* world.getComponent(entityId, 'position')
        if (position._tag === 'Some') {
          TestAssert.positionInBounds(position.value, {
            minX: -1000, maxX: 1000,
            minY: 0, maxY: 256,
            minZ: -1000, maxZ: 1000
          })
        }
        
        return true
      })
  )
})

/**
 * Example 7: Mock Service Integration
 */
it.effect('should test with mocked services', () => {
  const mockPattern = TestPatterns.withMockedServices('World', 'InputManager')
  
  return mockPattern.runTest(
    Effect.gen(function* () {
      const world = yield* World
      
      // Use the mocked world service
      const entityId = yield* world.addArchetype(PlayerFixtures.default())
      
      // Verify mock interactions
      mockPattern.verifyMock('World', 'addArchetype', 1)
    })
  )
})

/**
 * Example 8: Performance Benchmarking
 */
it.effect('should benchmark entity creation performance', () => {
  const benchmark = TestPatterns.benchmarkTest('Entity Creation', 50)
  
  return benchmark.expectMaxDuration(10)( // Max 10ms average
    Effect.gen(function* () {
      const world = yield* World
      
      // Create and add a complex entity
      const entity = pipe(
        entityBuilder.create(),
        entityBuilder.withPosition(
          Math.random() * 100,
          Math.random() * 100,
          Math.random() * 100
        ),
        entityBuilder.asPlayer(),
        entityBuilder.withInputState({
          forward: true,
          sprint: true,
          place: false,
          destroy: false
        }),
        entityBuilder.withHotbar(
          Array(9).fill(BlockType.STONE),
          Math.floor(Math.random() * 9)
        ),
        entityBuilder.build
      )
      
      yield* world.addArchetype(entity)
    })
  )
})

/**
 * Example 9: Time-Based Testing
 */
it.effect('should test physics over time', () => {
  const timeTest = TestPatterns.timeBasedTest()
  
  return timeTest.harness.runEffect(
    Effect.gen(function* () {
      const world = yield* World
      
      // Create falling player
      const fallingPlayer = PlayerFixtures.falling()
      const entityId = yield* world.addArchetype(fallingPlayer)
      
      // Test over 2 seconds with 10 steps
      const positions = yield* timeTest.runOverTime(
        Effect.gen(function* () {
          const position = yield* world.getComponent(entityId, 'position')
          return position._tag === 'Some' ? position.value : null
        }),
        2000, // 2 seconds
        10    // 10 steps
      )
      
      // Player should fall over time
      const validPositions = positions.filter(p => p !== null)
      expect(validPositions.length).toBeGreaterThan(0)
      
      if (validPositions.length > 1) {
        // Y position should decrease (falling)
        expect(validPositions[validPositions.length - 1]!.y)
          .toBeLessThan(validPositions[0]!.y)
      }
    })
  )
})

/**
 * Example 10: Complex Scenario Testing
 */
it.effect('should test building construction scenario', () => {
  const harness = TestHarness.create()
  
  return harness.runProperty(
    ScenarioArbs.buildingScenario,
    (scenario) =>
      Effect.gen(function* () {
        const world = yield* World
        
        // Add builder and foundation
        const builderId = yield* world.addArchetype(scenario.builder)
        
        for (const block of scenario.foundation) {
          yield* world.addArchetype(block)
        }
        
        // Verify builder has materials
        const hotbar = yield* world.getComponent(builderId, 'hotbar')
        expect(hotbar._tag).toBe('Some')
        
        if (hotbar._tag === 'Some') {
          const materials = hotbar.value.slots.filter(slot => slot !== BlockType.AIR)
          expect(materials.length).toBeGreaterThan(0)
          expect(materials).toContain(BlockType.STONE)
        }
        
        // Verify building site dimensions are reasonable
        expect(scenario.buildingSite.width).toBeGreaterThan(2)
        expect(scenario.buildingSite.height).toBeGreaterThan(1)
        expect(scenario.buildingSite.depth).toBeGreaterThan(2)
        
        return true
      })
  )
})

/**
 * Example 11: Error Condition Testing
 */
it.effect('should handle invalid entity creation gracefully', () => {
  const harness = TestHarness.create()
  
  return harness.runEffect(
    Effect.gen(function* () {
      const world = yield* World
      
      // Try to create entity with missing required components
      const invalidEntity = { components: {} } // No position component
      
      // This should fail gracefully
      const result = yield* Effect.attempt(
        world.addArchetype(invalidEntity as any)
      )
      
      expect(result._tag).toBe('Left') // Should fail
    })
  )
})

/**
 * Example 12: Quick Test Patterns
 */
it.effect('should use quick test helpers', () => {
  // Quick entity validation
  const player = QuickTest.entity(
    () => presets.player(0, 64, 0),
    'position', 'player', 'velocity'
  )
  
  expect(player.components.position).toEqual({ x: 0, y: 64, z: 0 })
  
  // Quick effect test
  return QuickTest.effect(
    Effect.gen(function* () {
      const world = yield* World
      yield* world.addArchetype(player)
      
      const entities = yield* world.query([])
      expect(entities.length).toBeGreaterThan(0)
    })
  )
})