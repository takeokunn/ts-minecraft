import { Effect } from 'effect'
import { World } from '@/services/world'
import { worldBuilder } from './world.builder'
import { entityBuilder, presets } from './entity.builder'
import { BlockType } from '@/domain/block-types'
import { Archetype } from '@/domain/archetypes'

/**
 * Scenario Builder - High-level test scenario construction
 * 
 * Features:
 * - Common gameplay scenarios
 * - Complex multi-entity setups
 * - Time-based scenario progression
 * - Interactive scenario validation
 */

/**
 * Scenario builder state
 */
type ScenarioBuilderState = {
  readonly name: string
  readonly description: string
  readonly entities: ReadonlyArray<Archetype>
  readonly expectedOutcomes: ReadonlyArray<string>
  readonly timeSteps: ReadonlyArray<{ time: number; action: string; description: string }>
}

const initialScenarioState = (name: string, description: string): ScenarioBuilderState => ({
  name,
  description,
  entities: [],
  expectedOutcomes: [],
  timeSteps: []
})

/**
 * Scenario builder functions
 */
export const scenarioBuilder = {
  /**
   * Create a new scenario
   */
  create: (name: string, description: string = '') => initialScenarioState(name, description),

  /**
   * Add entities to the scenario
   */
  withEntities: (entities: ReadonlyArray<Archetype>) =>
    (state: ScenarioBuilderState): ScenarioBuilderState => ({
      ...state,
      entities: [...state.entities, ...entities]
    }),

  /**
   * Add a single entity
   */
  withEntity: (entity: Archetype) =>
    (state: ScenarioBuilderState): ScenarioBuilderState => ({
      ...state,
      entities: [...state.entities, entity]
    }),

  /**
   * Add expected outcomes for validation
   */
  expectingOutcomes: (outcomes: ReadonlyArray<string>) =>
    (state: ScenarioBuilderState): ScenarioBuilderState => ({
      ...state,
      expectedOutcomes: [...state.expectedOutcomes, ...outcomes]
    }),

  /**
   * Add time-based steps
   */
  withTimeStep: (time: number, action: string, description: string = '') =>
    (state: ScenarioBuilderState): ScenarioBuilderState => ({
      ...state,
      timeSteps: [...state.timeSteps, { time, action, description }]
    }),

  /**
   * Build the scenario as a world effect
   */
  build: (state: ScenarioBuilderState): Effect.Effect<void, never, World> =>
    Effect.gen(function* () {
      const world = yield* World
      
      // Add all entities to the world
      for (const entity of state.entities) {
        yield* world.addArchetype(entity)
      }
    }),

  /**
   * Build scenario with metadata
   */
  buildWithMetadata: (state: ScenarioBuilderState) => ({
    name: state.name,
    description: state.description,
    expectedOutcomes: state.expectedOutcomes,
    timeSteps: state.timeSteps,
    setupEffect: scenarioBuilder.build(state),
    entityCount: state.entities.length
  })
}

/**
 * Predefined scenario templates
 */
export const ScenarioTemplates = {
  /**
   * Basic player spawning scenario
   */
  playerSpawn: () =>
    pipe(
      scenarioBuilder.create('Player Spawn', 'Player spawns at world origin'),
      scenarioBuilder.withEntity(presets.player(0, 64, 0)),
      scenarioBuilder.withEntities([
        presets.block(0, 63, 0, BlockType.GRASS),
        presets.block(1, 63, 0, BlockType.GRASS),
        presets.block(-1, 63, 0, BlockType.GRASS),
        presets.block(0, 63, 1, BlockType.GRASS),
        presets.block(0, 63, -1, BlockType.GRASS)
      ]),
      scenarioBuilder.expectingOutcomes([
        'Player should be grounded',
        'Player should have default inventory',
        'Player should be looking straight ahead'
      ])
    ),

  /**
   * Block breaking scenario
   */
  blockBreaking: () =>
    pipe(
      scenarioBuilder.create('Block Breaking', 'Player breaks a block'),
      scenarioBuilder.withEntity(
        pipe(
          entityBuilder.create(),
          entityBuilder.withPosition(0, 64, 0),
          entityBuilder.asPlayer(),
          entityBuilder.withInputState({ destroy: true }),
          entityBuilder.build
        )
      ),
      scenarioBuilder.withEntity(presets.block(0, 63, 0, BlockType.STONE)),
      scenarioBuilder.withTimeStep(0, 'start_breaking', 'Player starts breaking block'),
      scenarioBuilder.withTimeStep(1000, 'block_broken', 'Block should be destroyed'),
      scenarioBuilder.expectingOutcomes([
        'Block should be removed from world',
        'Player inventory should contain stone block',
        'Block breaking particles should be generated'
      ])
    ),

  /**
   * Block placing scenario
   */
  blockPlacing: () =>
    pipe(
      scenarioBuilder.create('Block Placing', 'Player places a block'),
      scenarioBuilder.withEntity(
        pipe(
          entityBuilder.create(),
          entityBuilder.withPosition(0, 64, 0),
          entityBuilder.asPlayer(),
          entityBuilder.withInputState({ place: true }),
          entityBuilder.withHotbar([BlockType.STONE, ...Array(8).fill(BlockType.AIR)], 0),
          entityBuilder.build
        )
      ),
      scenarioBuilder.withEntity(presets.block(0, 63, 0, BlockType.GRASS)),
      scenarioBuilder.withTimeStep(0, 'start_placing', 'Player starts placing block'),
      scenarioBuilder.withTimeStep(100, 'block_placed', 'Block should be placed'),
      scenarioBuilder.expectingOutcomes([
        'New block should appear in world',
        'Player hotbar should have one less stone block',
        'Block placement should be at targeted location'
      ])
    ),

  /**
   * Player movement scenario
   */
  playerMovement: () =>
    pipe(
      scenarioBuilder.create('Player Movement', 'Player moves around the world'),
      scenarioBuilder.withEntity(
        pipe(
          entityBuilder.create(),
          entityBuilder.withPosition(0, 64, 0),
          entityBuilder.withVelocity(0, 0, 0),
          entityBuilder.asPlayer(true),
          entityBuilder.withInputState({ forward: true, sprint: true }),
          entityBuilder.build
        )
      ),
      // Ground plane
      scenarioBuilder.withEntities(
        Array.from({ length: 25 }, (_, i) => {
          const x = (i % 5) - 2
          const z = Math.floor(i / 5) - 2
          return presets.block(x, 63, z, BlockType.GRASS)
        })
      ),
      scenarioBuilder.withTimeStep(0, 'start_moving', 'Player starts moving forward'),
      scenarioBuilder.withTimeStep(1000, 'check_position', 'Player should have moved forward'),
      scenarioBuilder.expectingOutcomes([
        'Player position.z should be greater than 0',
        'Player should still be grounded',
        'Player velocity should be positive in z direction'
      ])
    ),

  /**
   * Falling physics scenario
   */
  fallingPhysics: () =>
    pipe(
      scenarioBuilder.create('Falling Physics', 'Player falls due to gravity'),
      scenarioBuilder.withEntity(
        pipe(
          entityBuilder.create(),
          entityBuilder.withPosition(0, 80, 0),
          entityBuilder.withVelocity(0, 0, 0),
          entityBuilder.asPlayer(false),
          entityBuilder.withGravity(-32),
          entityBuilder.build
        )
      ),
      scenarioBuilder.withEntity(presets.block(0, 63, 0, BlockType.STONE)),
      scenarioBuilder.withTimeStep(0, 'start_falling', 'Player starts falling'),
      scenarioBuilder.withTimeStep(500, 'mid_fall', 'Player should be falling'),
      scenarioBuilder.withTimeStep(1500, 'landed', 'Player should have landed'),
      scenarioBuilder.expectingOutcomes([
        'Player should land on the block',
        'Player should be grounded after landing',
        'Player velocity should be 0 after landing'
      ])
    ),

  /**
   * Multi-player interaction scenario
   */
  multiplayerInteraction: () =>
    pipe(
      scenarioBuilder.create('Multiplayer Interaction', 'Multiple players in the same area'),
      scenarioBuilder.withEntities([
        presets.player(0, 64, 0),
        presets.player(5, 64, 0),
        presets.player(10, 64, 0)
      ]),
      // Shared ground
      scenarioBuilder.withEntities(
        Array.from({ length: 100 }, (_, i) => {
          const x = (i % 10) - 5
          const z = Math.floor(i / 10) - 5
          return presets.block(x * 2, 63, z * 2, BlockType.STONE)
        })
      ),
      scenarioBuilder.expectingOutcomes([
        'All players should be grounded',
        'Players should not overlap',
        'Each player should have independent state'
      ])
    ),

  /**
   * Complex building scenario
   */
  buildingConstruction: () =>
    pipe(
      scenarioBuilder.create('Building Construction', 'Player builds a structure'),
      scenarioBuilder.withEntity(
        pipe(
          entityBuilder.create(),
          entityBuilder.withPosition(0, 64, 0),
          entityBuilder.asPlayer(),
          entityBuilder.withHotbar([
            BlockType.STONE, BlockType.WOOD, BlockType.GLASS, 
            BlockType.BRICK, ...Array(5).fill(BlockType.AIR)
          ]),
          entityBuilder.build
        )
      ),
      // Foundation
      scenarioBuilder.withEntities(
        Array.from({ length: 16 }, (_, i) => {
          const x = (i % 4) - 1.5
          const z = Math.floor(i / 4) - 1.5
          return presets.block(x, 63, z, BlockType.STONE)
        })
      ),
      scenarioBuilder.withTimeStep(0, 'start_building', 'Player starts construction'),
      scenarioBuilder.withTimeStep(1000, 'place_walls', 'Player places wall blocks'),
      scenarioBuilder.withTimeStep(2000, 'add_roof', 'Player adds roof structure'),
      scenarioBuilder.expectingOutcomes([
        'Structure should have walls',
        'Structure should have a roof',
        'Player inventory should be depleted',
        'All placed blocks should be stable'
      ])
    ),

  /**
   * Water physics scenario
   */
  waterPhysics: () =>
    pipe(
      scenarioBuilder.create('Water Physics', 'Player interacts with water'),
      scenarioBuilder.withEntity(
        pipe(
          entityBuilder.create(),
          entityBuilder.withPosition(0, 70, 0),
          entityBuilder.withVelocity(0, -5, 0),
          entityBuilder.asPlayer(false),
          entityBuilder.build
        )
      ),
      // Water pool
      scenarioBuilder.withEntities(
        Array.from({ length: 25 }, (_, i) => {
          const x = (i % 5) - 2
          const z = Math.floor(i / 5) - 2
          return presets.block(x, 65, z, BlockType.WATER)
        })
      ),
      // Pool bottom
      scenarioBuilder.withEntities(
        Array.from({ length: 25 }, (_, i) => {
          const x = (i % 5) - 2
          const z = Math.floor(i / 5) - 2
          return presets.block(x, 64, z, BlockType.STONE)
        })
      ),
      scenarioBuilder.withTimeStep(0, 'start_falling', 'Player falls toward water'),
      scenarioBuilder.withTimeStep(500, 'enter_water', 'Player enters water'),
      scenarioBuilder.withTimeStep(1000, 'swimming', 'Player should be swimming'),
      scenarioBuilder.expectingOutcomes([
        'Player movement should be slowed in water',
        'Player should float in water',
        'Water should apply buoyancy force'
      ])
    ),

  /**
   * Performance stress test scenario
   */
  performanceStress: () =>
    pipe(
      scenarioBuilder.create('Performance Stress Test', 'Many entities for performance testing'),
      scenarioBuilder.withEntities(
        // 100 players
        Array.from({ length: 100 }, (_, i) => {
          const angle = (i / 100) * 2 * Math.PI
          const radius = 50
          return presets.player(
            Math.cos(angle) * radius,
            64,
            Math.sin(angle) * radius
          )
        })
      ),
      scenarioBuilder.withEntities(
        // 1000 blocks
        Array.from({ length: 1000 }, (_, i) => {
          const x = (i % 32) - 16
          const z = Math.floor(i / 32) - 16
          return presets.block(x, 63, z, i % 2 === 0 ? BlockType.STONE : BlockType.DIRT)
        })
      ),
      scenarioBuilder.expectingOutcomes([
        'Frame rate should remain above 30 FPS',
        'Memory usage should remain stable',
        'All entities should update correctly',
        'Collision detection should work for all entities'
      ])
    )
}

/**
 * Scenario validation utilities
 */
export const ScenarioValidator = {
  /**
   * Validate scenario setup
   */
  validateSetup: (scenario: ReturnType<typeof scenarioBuilder.buildWithMetadata>) => {
    const issues: string[] = []

    if (scenario.entityCount === 0) {
      issues.push('Scenario has no entities')
    }

    if (scenario.expectedOutcomes.length === 0) {
      issues.push('Scenario has no expected outcomes')
    }

    if (scenario.name.trim().length === 0) {
      issues.push('Scenario has no name')
    }

    return {
      valid: issues.length === 0,
      issues
    }
  },

  /**
   * Run scenario and validate outcomes
   */
  runAndValidate: <R>(
    scenario: ReturnType<typeof scenarioBuilder.buildWithMetadata>,
    validator: () => Effect.Effect<boolean, never, R>
  ): Effect.Effect<{ passed: boolean; outcomes: string[] }, never, World | R> =>
    Effect.gen(function* () {
      // Setup the scenario
      yield* scenario.setupEffect

      // Run the validator
      const passed = yield* validator()

      return {
        passed,
        outcomes: scenario.expectedOutcomes as string[]
      }
    })
}

/**
 * Helper for pipe - functional composition
 */
function pipe<A>(value: A): A
function pipe<A, B>(value: A, fn1: (a: A) => B): B
function pipe<A, B, C>(value: A, fn1: (a: A) => B, fn2: (b: B) => C): C
function pipe<A, B, C, D>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D): D
function pipe<A, B, C, D, E>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D, fn4: (d: D) => E): E
function pipe<A, B, C, D, E, F>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D, fn4: (d: D) => E, fn5: (e: E) => F): F
function pipe<A, B, C, D, E, F, G>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D, fn4: (d: D) => E, fn5: (e: E) => F, fn6: (f: F) => G): G
function pipe<A, B, C, D, E, F, G, H>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D, fn4: (d: D) => E, fn5: (e: E) => F, fn6: (f: F) => G, fn7: (g: G) => H): H
function pipe<A, B, C, D, E, F, G, H, I>(value: A, fn1: (a: A) => B, fn2: (b: B) => C, fn3: (c: C) => D, fn4: (d: D) => E, fn5: (e: E) => F, fn6: (f: F) => G, fn7: (g: G) => H, fn8: (h: H) => I): I
function pipe(value: any, ...fns: Array<(a: any) => any>): any {
  return fns.reduce((acc, fn) => fn(acc), value)
}