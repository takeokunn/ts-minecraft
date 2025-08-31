import { registerComponent } from "@/runtime/world";
import { Option, Schema } from "effect";
import { BlockType, BlockTypeSchema } from "./block";

// Base class for components to ensure they have a `_tag` property.
// The `A` parameter is a trick to make the tag unique for each class.
export abstract class Component<
  A extends string,
> extends Schema.Class<any>(A) {
  abstract readonly _tag: A;

  static getTag(): string {
    // biome-ignore lint/suspicious/noExplicitAny: <explanation>
    return Schema.getIdentifier(this as any).pipe(Option.getOrThrow);
  }
}

export const Position = registerComponent(
  class Position extends Component("Position")({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }) {},
);
export type Position = InstanceType<typeof Position>;

export const Velocity = registerComponent(
  class Velocity extends Component("Velocity")({
    dx: Schema.Number,
    dy: Schema.Number,
    dz: Schema.Number,
  }) {},
);
export type Velocity = InstanceType<typeof Velocity>;

export const Renderable = registerComponent(
  class Renderable extends Component("Renderable")({
    geometry: Schema.Literal("box"),
    blockType: BlockTypeSchema,
  }) {},
);
export type Renderable = InstanceType<typeof Renderable>;

export const Player = registerComponent(
  class Player extends Component("Player")({
    isGrounded: Schema.Boolean,
  }) {},
);
export type Player = InstanceType<typeof Player>;

export const InputState = registerComponent(
  class InputState extends Component("InputState")({
    forward: Schema.Boolean,
    backward: Schema.Boolean,
    left: Schema.Boolean,
    right: Schema.Boolean,
    jump: Schema.Boolean,
    sprint: Schema.Boolean,
    place: Schema.Boolean,
  }) {},
);
export type InputState = InstanceType<typeof InputState>;

export const Gravity = registerComponent(
  class Gravity extends Component("Gravity")({
    value: Schema.Number,
  }) {},
);
export type Gravity = InstanceType<typeof Gravity>;

export const CameraState = registerComponent(
  class CameraState extends Component("CameraState")({
    pitch: Schema.Number,
    yaw: Schema.Number,
  }) {},
);
export type CameraState = InstanceType<typeof CameraState>;

export const TerrainBlock = registerComponent(
  class TerrainBlock extends Component("TerrainBlock")({}) {},
);
export type TerrainBlock = InstanceType<typeof TerrainBlock>;

export const Chunk = registerComponent(
  class Chunk extends Component("Chunk")({
    x: Schema.Number,
    z: Schema.Number,
  }) {},
);
export type Chunk = InstanceType<typeof Chunk>;

export const Collider = registerComponent(
  class Collider extends Component("Collider")({
    width: Schema.Number,
    height: Schema.Number,
    depth: Schema.Number,
  }) {},
);
export type Collider = InstanceType<typeof Collider>;

export const Hotbar = registerComponent(
  class Hotbar extends Component("Hotbar")({
    slots: Schema.Array(BlockTypeSchema),
    selectedSlot: Schema.Number,
  }) {},
);
export type Hotbar = InstanceType<typeof Hotbar>;

export const Target = registerComponent(
  class Target extends Component("Target")({
    id: Schema.String, // EntityId of the targeted block
    position: Position,
    face: Schema.Tuple(Schema.Number, Schema.Number, Schema.Number),
  }) {},
);
export type Target = InstanceType<typeof Target>;

export const ComponentUnion = Schema.Union(
  Position,
  Velocity,
  Renderable,
  Player,
  InputState,
  Gravity,
  CameraState,
  TerrainBlock,
  Chunk,
  Collider,
  Hotbar,
  Target,
);
export type ComponentAny = Schema.Schema.Type<typeof ComponentUnion>;

// --- Save State Schemas ---

export class PlacedBlock extends Schema.Class<PlacedBlock>("PlacedBlock")({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
  blockType: Schema.String.pipe(Schema.compose(BlockTypeSchema)),
}) {}

export class DestroyedBlock extends Schema.Class<DestroyedBlock>(
  "DestroyedBlock",
)({
  x: Schema.Number,
  y: Schema.Number,
  z: Schema.Number,
}) {}

export class SaveState extends Schema.Class<SaveState>("SaveState")({
  seeds: Schema.Struct({
    world: Schema.Number,
    biome: Schema.Number,
    trees: Schema.Number,
  }),
  amplitude: Schema.Number,
  cameraPosition: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  playerRotation: Schema.Struct({
    x: Schema.Number,
    y: Schema.Number,
    z: Schema.Number,
  }),
  editedBlocks: Schema.Struct({
    placed: Schema.Array(PlacedBlock),
    destroyed: Schema.Array(DestroyedBlock),
  }),
}) {}
