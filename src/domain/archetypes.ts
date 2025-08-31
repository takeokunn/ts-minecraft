import { Effect } from "effect";
import { World } from "../runtime/world";
import {
  Block,
  CameraState,
  Collider,
  Gravity,
  Hotbar,
  InputState,
  Player,
  Position,
  Renderable,
  TerrainBlock,
  Velocity,
} from "./components";
import { hotbarSlots } from "./block";
import { BlockType } from "@/runtime/game-state";

export const createPlayer = (position: { x: number; y: number; z: number }) =>
  Effect.gen(function* (_) {
    const world = yield* _(World);
    return yield* _(
      world.createEntity([
        new Player({ isGrounded: false }),
        new Position(position),
        new Velocity({ dx: 0, dy: 0, dz: 0 }),
        new Gravity({ value: 0.01 }),
        new CameraState({ pitch: 0, yaw: 0 }),
        new InputState({
          forward: false,
          backward: false,
          left: false,
          right: false,
          jump: false,
          sprint: false,
          destroy: false,
          place: false,
        }),
        new Collider({ width: 0.6, height: 1.8, depth: 0.6 }),
        new Hotbar({
          slots: [...hotbarSlots],
          selectedSlot: 0,
        }),
      ]),
    );
  });

export const createBlock = (
  position: { x: number; y: number; z: number },
  blockType: BlockType,
) =>
  Effect.gen(function* (_) {
    const world = yield* _(World);
    return yield* _(
      world.createEntity([
        new Position(position),
        new Block({ id: blockType }),
        new Renderable({ blockType, geometry: "box" }),
        new TerrainBlock(),
      ]),
    );
  });
