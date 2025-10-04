import { Effect, Schema } from 'effect'
import * as fc from 'effect/FastCheck'
import { describe, expect, it } from 'vitest'
import {
  applyCommand,
  computeJumpVelocity,
  createPlayer,
  transitionState,
  updatePosition,
  updateVitals,
} from '../operations'
import { PlayerAggregateSchema } from '../types'
import { aggregateArb, creationInputArb, motionArb, positionArb, vitalsArb } from './generators'

const run = <A>(effect: Effect.Effect<A>) => Effect.runPromise(effect)

describe('player operations', () => {
  it('createPlayerは入力のIDとタイムスタンプを保持する', async () => {
    await fc.assert(
      fc.asyncProperty(creationInputArb, async (input) => {
        const result = await run(createPlayer(input))
        expect(result.aggregate.id).toStrictEqual(input.id)
        expect(result.aggregate.createdAt).toBe(input.timestamp)
        expect(result.event._tag).toBe('PlayerCreated')
      })
    )
  })

  it('updateVitalsは新しいタイムスタンプと値を適用する', async () => {
    await fc.assert(
      fc.asyncProperty(aggregateArb, vitalsArb, fc.integer({ min: 1, max: 5000 }), async (aggregate, vitals, delta) => {
        const timestamp = aggregate.updatedAt + Math.abs(delta)
        const result = await run(
          updateVitals(
            aggregate,
            {
              health: vitals.health,
              hunger: vitals.hunger,
              saturation: vitals.saturation,
              experienceLevel: vitals.experienceLevel,
            },
            { timestamp }
          )
        )
        expect(result.aggregate.vitals).toStrictEqual(vitals)
        expect(result.aggregate.updatedAt).toBe(timestamp)
      })
    )
  })

  it('transitionStateは許可された遷移のみ成功する', async () => {
    const transitions: ReadonlyArray<
      readonly [
        'loading' | 'alive' | 'dead' | 'respawning' | 'teleporting' | 'disconnected',
        'loading' | 'alive' | 'dead' | 'respawning' | 'teleporting' | 'disconnected',
      ]
    > = [
      ['loading', 'alive'],
      ['alive', 'dead'],
      ['dead', 'respawning'],
      ['respawning', 'alive'],
      ['alive', 'teleporting'],
      ['teleporting', 'alive'],
      ['alive', 'disconnected'],
      ['dead', 'disconnected'],
      ['respawning', 'disconnected'],
      ['teleporting', 'disconnected'],
      ['loading', 'disconnected'],
      ['disconnected', 'loading'],
      ['alive', 'loading'],
      ['dead', 'alive'],
    ]

    await fc.assert(
      fc.asyncProperty(
        aggregateArb,
        fc.constantFrom(...transitions),
        fc.integer({ min: 1, max: 4000 }),
        async (aggregate, [from, to], delta) => {
          const base = Schema.decodeUnknownSync(PlayerAggregateSchema)({ ...aggregate, state: from })
          const timestamp = base.updatedAt + Math.abs(delta)
          const result = await run(transitionState(base, to, { timestamp }, `${from}->${to}`))
          expect(result.aggregate.state).toBe(to)
        }
      )
    )
  })

  it('applyCommandでCreatePlayerを既存集約に適用すると失敗する', async () => {
    await fc.assert(
      fc.asyncProperty(aggregateArb, creationInputArb, async (aggregate, input) => {
        const exit = await Effect.runPromiseExit(
          applyCommand(aggregate, {
            _tag: 'CreatePlayer',
            id: aggregate.id,
            name: input.name,
            gameMode: input.gameMode,
            timestamp: aggregate.updatedAt + 1,
          })
        )
        expect(exit._tag).toBe('Failure')
      })
    )
  })

  it('updatePositionは位置とモーションを更新する', async () => {
    await fc.assert(
      fc.asyncProperty(
        aggregateArb,
        positionArb,
        motionArb,
        fc.integer({ min: 1, max: 5000 }),
        async (aggregate, position, motion, delta) => {
          const timestamp = aggregate.updatedAt + Math.abs(delta)
          const result = await run(updatePosition(aggregate, { position, motion }, { timestamp }))
          expect(result.aggregate.position).toStrictEqual(position)
          expect(result.aggregate.motion).toStrictEqual(motion)
        }
      )
    )
  })
  it('computeJumpVelocityはゲームモードに応じた速度となる', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<'survival' | 'creative' | 'spectator' | 'adventure'>(
          'survival',
          'creative',
          'spectator',
          'adventure'
        ),
        async (mode) => {
          const velocity = await run(computeJumpVelocity(mode))
          expect(velocity).toBeGreaterThan(0)
        }
      )
    )
  })
})
