import { Effect, Option } from 'effect'
import { BlockHighlightService } from '@ts-minecraft/presentation'
import type { RaycastHit } from '@ts-minecraft/rendering'

/** Creates a block highlight fake with no current target. */
export const makeBlockHighlight = () =>
  BlockHighlightService.of({
    _tag: '@minecraft/presentation/BlockHighlight' as const,
    initialize: (_scene: unknown) => Effect.void,
    update: (_cam: unknown, _scene: unknown) => Effect.void,
    invalidateCache: () => Effect.void,
    setVisible: (_visible: boolean) => Effect.void,
    getTargetBlock: () => Effect.succeed(Option.none()),
    getTargetHit: () => Effect.succeed(Option.none()),
    setTargetForQA: (_target: unknown, _hit: unknown) => Effect.void,
    clearTargetForQA: () => Effect.void,
  })

/** Creates a block highlight fake pointing at a specific block position (or no target when null). */
export const makeTargetBlockHighlight = (
  target: { x: number; y: number; z: number } | null,
  hit: RaycastHit | null = null,
) =>
  BlockHighlightService.of({
    _tag: '@minecraft/presentation/BlockHighlight' as const,
    initialize: (_scene: unknown) => Effect.void,
    update: (_cam: unknown, _scene: unknown) => Effect.void,
    invalidateCache: () => Effect.void,
    setVisible: (_visible: boolean) => Effect.void,
    getTargetBlock: () => Effect.succeed(target ? Option.some(target) : Option.none()),
    getTargetHit: () => Effect.succeed(hit ? Option.some(hit) : Option.none()),
    setTargetForQA: (_target: unknown, _hit: unknown) => Effect.void,
    clearTargetForQA: () => Effect.void,
  })
