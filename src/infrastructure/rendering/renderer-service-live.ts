import { Clock, Effect, Layer, Option, Ref } from 'effect'
import {
  Alpha,
  defaultAlpha,
  defaultClearColor,
  defaultPixelRatio,
  defaultViewport,
  PixelRatio,
  RendererService,
  RendererSnapshot,
  RendererTargetId,
  RgbColor,
  Viewport,
} from './renderer-service'

const makeInitialSnapshot = (): RendererSnapshot => ({
  target: Option.none(),
  clearColor: defaultClearColor,
  alpha: defaultAlpha,
  pixelRatio: defaultPixelRatio,
  viewport: defaultViewport,
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
    const stateRef = yield* Ref.make(makeInitialSnapshot())

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

    const reset = Ref.set(stateRef, makeInitialSnapshot())

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
