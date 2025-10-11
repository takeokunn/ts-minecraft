import { Clock, Effect, Layer, Option, Ref } from 'effect'
import {
  Alpha,
  PixelRatio,
  RendererService,
  RendererSnapshot,
  RendererTargetId,
  RgbColor,
  Viewport,
  decodeAlpha,
  decodePixelRatio,
  decodeRgbColor,
  decodeViewport,
} from './renderer-service'

const makeInitialSnapshot = (defaults: {
  readonly clearColor: RgbColor
  readonly alpha: Alpha
  readonly pixelRatio: PixelRatio
  readonly viewport: Viewport
}): RendererSnapshot => ({
  target: Option.none(),
  clearColor: defaults.clearColor,
  alpha: defaults.alpha,
  pixelRatio: defaults.pixelRatio,
  viewport: defaults.viewport,
  frames: 0,
  lastUpdatedAt: 0,
})

const updateWithTimestamp = (
  ref: Ref.Ref<RendererSnapshot>,
  mutate: (snapshot: RendererSnapshot, timestamp: number) => RendererSnapshot
) => Effect.flatMap(Clock.currentTimeMillis, (timestamp) => Ref.update(ref, (snapshot) => mutate(snapshot, timestamp)))

export const RendererServiceLive = Layer.effect(
  RendererService,
  Effect.gen(function* () {
    const defaultClearColor = yield* decodeRgbColor(0x000000)
    const defaultAlpha = yield* decodeAlpha(1)
    const defaultPixelRatio = yield* decodePixelRatio(1)
    const defaultViewport = yield* decodeViewport({ width: 0, height: 0 })

    const makeSnapshot = () =>
      makeInitialSnapshot({
        clearColor: defaultClearColor,
        alpha: defaultAlpha,
        pixelRatio: defaultPixelRatio,
        viewport: defaultViewport,
      })

    const stateRef = yield* Ref.make(makeSnapshot())

    const bindTarget = (id: RendererTargetId) =>
      updateWithTimestamp(stateRef, (snapshot, timestamp) => ({
        ...snapshot,
        target: Option.some(id),
        lastUpdatedAt: timestamp,
      }))

    const setViewport = (viewport: Viewport) =>
      updateWithTimestamp(stateRef, (snapshot, timestamp) => ({
        ...snapshot,
        viewport,
        lastUpdatedAt: timestamp,
      }))

    const setPixelRatio = (ratio: PixelRatio) =>
      updateWithTimestamp(stateRef, (snapshot, timestamp) => ({
        ...snapshot,
        pixelRatio: ratio,
        lastUpdatedAt: timestamp,
      }))

    const setClearColor = (color: RgbColor, alpha: Alpha) =>
      updateWithTimestamp(stateRef, (snapshot, timestamp) => ({
        ...snapshot,
        clearColor: color,
        alpha,
        lastUpdatedAt: timestamp,
      }))

    const frameRendered = updateWithTimestamp(stateRef, (snapshot, timestamp) => ({
      ...snapshot,
      frames: snapshot.frames + 1,
      lastUpdatedAt: timestamp,
    }))

    const snapshot = Ref.get(stateRef)

    const reset = Ref.set(stateRef, makeSnapshot())

    return RendererService.of({
      bindTarget,
      setViewport,
      setPixelRatio,
      setClearColor,
      frameRendered,
      snapshot,
      reset,
    })
  })
)
