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
  Target,
  TerrainBlock,
  Velocity,
} from "./components";
import { createEntity } from "@/runtime/world";
import { BlockType, hotbarSlots } from "./block";

export const createPlayer = (pos: { x: number; y: number; z: number }) =>
  createEntity(
    { _tag: "Player", isGrounded: false },
    { _tag: "Position", ...pos },
    { _tag: "Velocity", dx: 0, dy: 0, dz: 0 },
    { _tag: "Gravity", value: 0.01 },
    { _tag: "CameraState", pitch: 0, yaw: 0 },
    {
      _tag: "InputState",
      forward: false,
      backward: false,
      left: false,
      right: false,
      jump: false,
      sprint: false,
      place: false,
    },
    { _tag: "Collider", width: 0.6, height: 1.8, depth: 0.6 },
    {
      _tag: "Hotbar",
      slot0: hotbarSlots[0],
      slot1: hotbarSlots[1],
      slot2: hotbarSlots[2],
      slot3: hotbarSlots[3],
      slot4: hotbarSlots[4],
      slot5: hotbarSlots[5],
      slot6: hotbarSlots[6],
      slot7: hotbarSlots[7],
      slot8: hotbarSlots[8],
      selectedSlot: 0,
    },
    { _tag: "Target", entityId: -1, faceX: 0, faceY: 0, faceZ: 0 },
  );

export const createBlock = (
  pos: { x: number; y: number; z: number },
  blockType: BlockType,
) =>
  createEntity(
    { _tag: "Position", ...pos },
    { _tag: "Renderable", geometry: "box", blockType },
    { _tag: "TerrainBlock" },
    { _tag: "Collider", width: 1, height: 1, depth: 1 },
  );
