import { describe, expect, it } from '@effect/vitest'
import { Effect, Option } from 'effect'
import * as Match from 'effect/Match'
import * as fc from 'effect/FastCheck'
import { provideLayers } from '../../testing/effect'
import {
  RendererService,
  parseAlpha,
  parsePixelRatio,
  parseRgbColor,
  parseTargetId,
  parseViewport,
} from './RendererService'
import { RendererServiceLive } from './RendererServiceLive'

const provideRenderer = <A>(effect: Effect.Effect<A>) =>
  effect.pipe(provideLayers(RendererServiceLive))

const range = (count: number): ReadonlyArray<number> =>
  Array.from({ length: count }, (_, index) => index)

const parseSucceeds = <A>(thunk: () => A) =>
  Effect.try({
    try: () => {
      thunk()
      return true as const
    },
  }).pipe(
    Effect.match({
      onFailure: () => false,
      onSuccess: () => true,
    })
  )

const parseFails = <A>(thunk: () => A) =>
  parseSucceeds(thunk).pipe(Effect.map((result) => !result))

describe('RendererService', () => {
  it.effect('setClearColor updates snapshot state', () =>
    provideRenderer(
      Effect.gen(function* () {
        const renderer = yield* RendererService
        const color = parseRgbColor(0x123456)
        const alpha = parseAlpha(0.5)

        yield* renderer.setClearColor(color, alpha)
        const snapshot = yield* renderer.snapshot

        expect(snapshot.clearColor).toBe(color)
        expect(snapshot.alpha).toBe(alpha)
      })
    )
  )

  it('parseRgbColor rejects out of range values', () => {
    const bounds = { min: -1000, max: 0x1_000000 + 1000 }
    fc.assert(
      fc.property(fc.integer(bounds), (value) => {
        return Match.value(value).pipe(
          Match.when(
            (candidate) => candidate >= 0x000000 && candidate <= 0xffffff,
            (valid) => Effect.runSync(parseSucceeds(() => parseRgbColor(valid)))
          ),
          Match.orElse((invalid) =>
            Effect.runSync(parseFails(() => parseRgbColor(invalid)))
          )
        )
      }),
      { verbose: false }
    )
  })

  it('parseAlpha enforces 0-1 inclusive', () => {
    fc.assert(
      fc.property(fc.double({ min: -10, max: 10 }), (value) => {
        return Match.value(value).pipe(
          Match.when(
            (candidate) => candidate >= 0 && candidate <= 1,
            (valid) => Effect.runSync(parseSucceeds(() => parseAlpha(valid)))
          ),
          Match.orElse((invalid) =>
            Effect.runSync(parseFails(() => parseAlpha(invalid)))
          )
        )
      })
    )
  })

  it.effect('frameRendered increments frame counter (property)', () =>
    Effect.sync(() =>
      fc.assert(
        fc.asyncProperty(fc.integer({ min: 0, max: 250 }), (count) =>
          Effect.runPromise(
            provideRenderer(
              Effect.gen(function* () {
                const service = yield* RendererService
                yield* Effect.forEach(range(count), () => service.frameRendered)
                const snapshot = yield* service.snapshot
                expect(snapshot.frames).toBe(count)
              })
            ).pipe(Effect.as(true))
          )
        ),
        { verbose: false }
      )
    )
  )

  it.effect('bindTarget + setViewport + setPixelRatio mutate snapshot cohesively', () =>
    provideRenderer(
      Effect.gen(function* () {
        const renderer = yield* RendererService
        const target = parseTargetId('primary-canvas')
        const viewport = parseViewport({ width: 1920, height: 1080 })
        const ratio = parsePixelRatio(2)

        yield* renderer.bindTarget(target)
        yield* renderer.setViewport(viewport)
        yield* renderer.setPixelRatio(ratio)

        const snapshot = yield* renderer.snapshot
        expect(snapshot.target).toEqual(Option.some(target))
        expect(snapshot.viewport).toEqual(viewport)
        expect(snapshot.pixelRatio).toEqual(ratio)
      })
    )
  )
})
