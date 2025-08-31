import { Layer } from 'effect';
import type { EntityId } from '../domain/entity';
import type { BlockType } from '../runtime/game-state';
import { RenderContext } from '../runtime/services';

export const RenderContextLive: Layer.Layer<RenderContext> = Layer.succeed(
  RenderContext,
  RenderContext.of({
    instanceIdToEntityId: new Map<BlockType, Map<number, EntityId>>(),
  }),
);
