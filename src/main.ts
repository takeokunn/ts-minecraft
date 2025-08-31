import {
  Effect,
  Layer,
  Ref,
  Schedule,
  Stream,
  Exit,
  Runtime,
} from 'effect';
import {
  CameraStateSchema,
  Hotbar,
  Player,
  PlayerSchema,
  Position,
  PositionSchema,
  SaveStateSchema,
  type CameraState,
  type Collider,
  type Gravity,
  type InputState,
  type SaveState,
  type Velocity,
} from './domain/components';
import type { EntityId } from './domain/entity';
import { InputLive } from './infrastructure/input-browser';
import {
  MaterialManager,
  MaterialManagerLive,
} from './infrastructure/material-manager';
import { RenderContextLive } from './infrastructure/render-context';
import {
  RendererLive,
  ThreeJsContext,
  ThreeJsContextLive,
} from './infrastructure/renderer-three';
import { UILive } from './infrastructure/ui';
import { GameState, GameStateLive, hotbarSlots } from './runtime/game-state';
import { gameLoop } from './runtime/loop';
import { loadGame, saveGame } from './runtime/save-load';
import {
  Input,
  RenderContext,
  Renderer,
  UI,
  MaterialManager,
} from './runtime/services';
import {
  createEntity,
  query,
  updateComponent,
  World,
  WorldLive,
  clearWorld,
} from './runtime/world';
import { generationSystem, uiSystem } from './systems';

// --- Player Creation ---
const createPlayer: Effect.Effect<EntityId, never, World> = createEntity(
  { _tag: 'Player', isGrounded: false } as Player,
  { _tag: 'Position', x: 0, y: 80, z: 0 } as Position,
  { _tag: 'Velocity', dx: 0, dy: 0, dz: 0 } as Velocity,
  { _tag: 'Gravity', value: 0.01 } as Gravity,
  { _tag: 'CameraState', pitch: 0, yaw: 0 } as CameraState,
  {
    _tag: 'InputState',
    forward: false,
    backward: false,
    left: false,
    right: false,
    jump: false,
    sprint: false,
    place: false,
  } as InputState,
  { _tag: 'Collider', width: 0.6, height: 1.8, depth: 0.6 } as Collider,
  {
    _tag: 'Hotbar',
    slots: [...hotbarSlots],
    selectedSlot: 0,
  } as Hotbar,
);

// --- Game Initialization ---
const setPlayerState = (
  loadedData: SaveState,
): Effect.Effect<void, never, World> =>
  Effect.gen(function* (_) {
    const playerQuery = yield* _(query(PlayerSchema));
    if (playerQuery.length === 0) return;
    const [playerId] = playerQuery[0];
    yield* _(
      updateComponent(playerId, {
        _tag: 'Position',
        ...loadedData.cameraPosition,
      }),
    );
    yield* _(
      updateComponent(playerId, {
        _tag: 'CameraState',
        pitch: loadedData.playerRotation.x,
        yaw: loadedData.playerRotation.y,
      }),
    );
  });

const initializeNewGame = Effect.gen(function* (_) {
  yield* _(clearWorld);
  yield* _(generationSystem);
  yield* _(createPlayer);
});

const initializeLoadedGame = (saveFile: File) =>
  Effect.gen(function* (_) {
    const json = yield* _(
      Effect.tryPromise({
        try: () => saveFile.text(),
        catch: (e) => new Error(`Failed to read file: ${e}`),
      }),
    );
    const data = yield* _(
      Effect.try({
        try: () => JSON.parse(json),
        catch: (e) => new Error(`Failed to parse JSON: ${e}`),
      }),
    );
    const loadedData = yield* _(Schema.decodeUnknown(SaveStateSchema)(data));
    yield* _(clearWorld);
    yield* _(loadGame(loadedData));
    yield* _(generationSystem);
    yield* _(createPlayer);
    yield* _(setPlayerState(loadedData));
  });

// --- UI Event Handling ---
const handleUIEvents = Effect.gen(function* (_) {
  const ui = yield* _(UI);
  const gameState = yield* _(GameState);
  const threeJsContext = yield* _(ThreeJsContext);

  const newGame = ui.events.newGame.pipe(
    Stream.runForEach(() =>
      Effect.gen(function* (_) {
        yield* _(initializeNewGame);
        yield* _(Ref.set(gameState.scene, 'InGame'));
        threeJsContext.controls.lock();
      }),
    ),
  );

  const load = ui.events.loadGame.pipe(
    Stream.runForEach((file) =>
      Effect.gen(function* (_) {
        yield* _(
          initializeLoadedGame(file),
          Effect.catchAll((error) =>
            Effect.sync(() => console.error(error.message)),
          ),
        );
        yield* _(Ref.set(gameState.scene, 'InGame'));
        threeJsContext.controls.lock();
      }),
    ),
  );

  const save = ui.events.saveGame.pipe(
    Stream.runForEach(() =>
      Effect.gen(function* (_) {
        yield* _(saveGame);
        yield* _(Ref.set(gameState.scene, 'Title'));
        // Controls are unlocked automatically by the browser
      }),
    ),
  );

  const backToGame = ui.events.backToGame.pipe(
    Stream.runForEach(() =>
      Effect.gen(function* (_) {
        yield* _(Ref.set(gameState.scene, 'InGame'));
        threeJsContext.controls.lock();
      }),
    ),
  );

  yield* _(Effect.fork(newGame));
  yield* _(Effect.fork(load));
  yield* _(Effect.fork(save));
  yield* _(Effect.fork(backToGame));
});

// --- Main Application ---
const MainLayer = Layer.mergeAll(
  ThreeJsContextLive,
  RenderContextLive,
  MaterialManagerLive,
  WorldLive,
  GameStateLive,
  UILive,
).pipe(
  Layer.provide(
    Layer.mergeAll(RendererLive, InputLive),
  ),
);

const app = Effect.gen(function* (_) {
  const gameState = yield* _(GameState);
  const { controls } = yield* _(ThreeJsContext);
  const runtime = yield* _(Effect.runtime<typeof MainLayer._R>());
  const runFork = Runtime.runFork(runtime);

  // Handle pointer lock/unlock to change scene
  controls.addEventListener('lock', () => {
    runFork(Ref.set(gameState.scene, 'InGame'));
  });
  controls.addEventListener('unlock', () => {
    runFork(
      Ref.get(gameState.scene).pipe(
        Effect.flatMap((scene) =>
          scene !== 'Title' ? Ref.set(gameState.scene, 'Paused') : Effect.void,
        ),
      ),
    );
  });

  yield* _(handleUIEvents);
  yield* _(
    Effect.fork(uiSystem.pipe(Effect.repeat(Schedule.spaced('100ms')))),
  );

  // Main game loop
  yield* _(
    gameLoop,
    Effect.whenEffect(
      Ref.get(gameState.scene).pipe(Effect.map((s) => s === 'InGame')),
    ),
    Effect.repeat(Schedule.animationFrame),
  );
});

// --- Run ---
const program = app.pipe(Effect.provide(MainLayer));
Effect.runFork(program);
