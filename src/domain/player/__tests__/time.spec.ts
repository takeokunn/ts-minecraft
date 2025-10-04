import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'
import { provideLayers } from '../../testing/effect'
import { PlayerClock, PlayerClockLive } from '../time'

const runWithClock = <A>(effect: Effect.Effect<A>) => Effect.runPromise(provideLayers(effect, PlayerClockLive))

describe('PlayerClock', () => {
  it('現在時刻が単調に増加する', async () => {
    const program = Effect.gen(function* () {
      const clock = yield* PlayerClock
      const first = yield* clock.current
      const second = yield* clock.current
      return [first, second] as const
    })

    const [first, second] = await runWithClock(program)
    expect(second).toBeGreaterThanOrEqual(first)
  })

  it('fromUnixでブランド付きタイムスタンプを生成する', async () => {
    const program = Effect.gen(function* () {
      const clock = yield* PlayerClock
      const timestamp = yield* clock.fromUnix(1234)
      return timestamp
    })

    const timestamp = await runWithClock(program)
    expect(timestamp).toBe(1234)
  })
})
