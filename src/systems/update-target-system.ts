import { Effect, Option } from "effect";
import { createTargetBlock, createTargetNone } from "@/domain/components";
import { playerTargetQuery, terrainBlockQuery } from "@/domain/queries";
import { RaycastService } from "@/infrastructure/raycast-three";
import { ThreeContext } from "@/infrastructure/types";
import { ThreeContextService } from "@/runtime/services";
import { World } from "@/runtime/world";

export const updateTargetSystem = Effect.gen(function* (_) {
  const world = yield* _(World);
  const raycast = yield* _(RaycastService);
  const context = (yield* _(ThreeContextService)) as ThreeContext;

  const players = yield* _(world.query(playerTargetQuery));
  const player = Option.fromNullable(players[0]);

  if (Option.isNone(player)) {
    return;
  }

  const terrainBlocks = yield* _(world.query(terrainBlockQuery));
  const terrainBlockMap = new Map(
    terrainBlocks.map((block) => [`${block.position.x},${block.position.y},${block.position.z}`, block.entityId]),
  );

  const result = yield* _(raycast.cast(context.scene, terrainBlockMap));

  yield* _(
    Option.match(result, {
      onNone: () => world.updateComponent(player.value.entityId, "target", createTargetNone()),
      onSome: (hit) => world.updateComponent(player.value.entityId, "target", createTargetBlock(hit.entityId, hit.face)),
    }),
  );
});

