import { describe, expect, it } from '@effect/vitest'
import { Effect } from 'effect'
import { GravityVector } from '../gravity-vector'
import { vector3, positiveFloat, unitInterval } from '../../types/core'

const run = <A>(program: Effect.Effect<A>) => Effect.runPromise(program)
const runExit = <A>(program: Effect.Effect<A, unknown>) => Effect.runPromiseExit(program)

describe('GravityVector', () => {
  it.effect('正規化された方向を維持する', () =>
    Effect.gen(function* () {
      const gravity = yield* GravityVector.create({
        direction: vector3({ x: 0, y: -9.8, z: 0 }),
        magnitude: 9.81,
      })

      expect(gravity.direction).toStrictEqual({ x: 0, y: -1, z: 0 })
      expect(gravity.magnitude).toBeCloseTo(9.81)
    })
  )

  it('零ベクトル方向は失敗する', async () => {
    const exit = await runExit(
      GravityVector.create({ direction: vector3({ x: 0, y: 0, z: 0 }), magnitude: 9.8 })
    )
    expect(exit._tag).toBe('Failure')
  })

  it.effect('終端速度を下回らないように補正する', () =>
    Effect.gen(function* () {
      const gravity = yield* GravityVector.create({
        terminalVelocity: 5,
      })

      const velocity = yield* GravityVector.apply(
        gravity,
        vector3({ x: 0, y: -10, z: 0 }),
        positiveFloat(1)
      )

      expect(velocity.y).toBeGreaterThanOrEqual(-gravity.terminalVelocity)
    })
  )

  it('跳躍速度を計算する', () => {
    const gravity = GravityVector.default
    const jumpVelocity = GravityVector.calculateJumpVelocity(gravity, positiveFloat(1.5))
    expect(jumpVelocity).toBeGreaterThan(0)
  })

  it('落下ダメージを距離から計算する', () => {
    const safe = GravityVector.calculateFallDamage(positiveFloat(3.1))
    const high = GravityVector.calculateFallDamage(positiveFloat(8))
    expect(safe).toBeCloseTo((3.1 - 3) * 0.5)
    expect(high).toBeCloseTo((8 - 3) * 0.5)
  })

  it('媒体別の重力プロファイルを生成する', () => {
    const air = GravityVector.forMedium(false)
    const water = GravityVector.forMedium(true)
    expect(air.multiplier).toBeCloseTo(1)
    expect(water.multiplier).toBeCloseTo(0.4)
    expect(water.terminalVelocity).toBeLessThan(air.terminalVelocity)
  })

  it('倍率を差し替えて新しい重力を得る', async () => {
    const gravity = await run(GravityVector.create({}))
    const adjusted = GravityVector.withMultiplier(gravity, unitInterval(0.75))
    expect(adjusted.multiplier).toBeCloseTo(0.75)
    expect(adjusted.magnitude).toBeCloseTo(gravity.magnitude)
  })
})
