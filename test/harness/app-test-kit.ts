import { Effect, HashMap, MutableHashSet, Option } from 'effect'
import {
  DEBUG_FEATURE_FLAG_CATALOG,
  DEBUG_FEATURE_FLAG_DEFAULTS,
  type DebugFeatureFlagGroup,
  type DebugFeatureFlagId,
} from '@ts-minecraft/app/application/debug-feature-flags'
import type { OverlayState } from './shared-test-kit'

/** Creates an inventory renderer fake backed by mutable overlay state. */
export const makeInventoryRenderer = (state: OverlayState) => ({
  isOpen: () => Effect.sync(() => state.open),
  toggle: () => Effect.sync(() => {
    state.open = !state.open
    return state.open
  }),
  update: () => Effect.void,
  cycleRecipes: (_delta: number) => Effect.void,
  craftSelectedRecipe: () => Effect.succeed(false),
}) as unknown as InstanceType<typeof import('@ts-minecraft/presentation').InventoryRendererService>

/** Creates a settings overlay fake backed by mutable overlay state. */
export const makeSettingsOverlay = (state: OverlayState) => ({
  isOpen: () => Effect.sync(() => state.open),
  toggle: () => Effect.sync(() => {
    state.open = !state.open
    return state.open
  }),
  syncFromSettings: () => Effect.void,
  applyToSettings: () => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/presentation').SettingsOverlayService>

/** Creates a pause menu fake with mutable open state. */
export const makePauseMenu = (state: OverlayState = { open: false }) => ({
  isOpen: () => Effect.sync(() => state.open),
  openIfClosed: () => Effect.sync(() => { state.open = true }),
  attach: (_control: unknown, _persist: unknown) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/presentation').PauseMenuService>

/** Creates a trading presentation fake backed by mutable overlay state. */
export const makeTradingPresentation = (state: OverlayState) => ({
  open: (_villagerId: string) => Effect.sync(() => {
    state.open = true
    return true
  }),
  close: () => Effect.sync(() => {
    state.open = false
  }),
  isOpen: () => Effect.sync(() => state.open),
  cycleSelection: (_delta: number) => Effect.void,
  refresh: () => Effect.void,
  executeSelectedTrade: () => Effect.succeed(false),
}) as unknown as InstanceType<typeof import('@ts-minecraft/presentation').TradingPresentationService>

type InputServiceInstance = InstanceType<typeof import('@ts-minecraft/presentation').InputService>

const buildInputService = (
  pressedKeys: MutableHashSet.MutableHashSet<string>,
  consumeMouseClick: (btn: number) => Effect.Effect<boolean>,
  isMouseDown: (btn: number) => Effect.Effect<boolean>,
): InputServiceInstance => ({
  consumeKeyPress: (key: string) => Effect.sync(() => {
    if (MutableHashSet.has(pressedKeys, key)) {
      MutableHashSet.remove(pressedKeys, key)
      return true
    }
    return false
  }),
  consumeMouseClick,
  isKeyPressed: (key: string) => Effect.succeed(MutableHashSet.has(pressedKeys, key)),
  getMouseDelta: () => Effect.succeed({ x: 0, y: 0 }),
  isMouseDown,
  requestPointerLock: () => Effect.void,
  exitPointerLock: () => Effect.void,
  isPointerLocked: () => Effect.succeed(false),
  consumeWheelDelta: () => Effect.succeed(0),
}) as unknown as InputServiceInstance

/** Creates an input service fake with consumable key presses and inert mouse input. */
export const makeInputService = (pressedKeys: MutableHashSet.MutableHashSet<string> = MutableHashSet.empty()) =>
  buildInputService(pressedKeys, (_btn) => Effect.succeed(false), (_btn) => Effect.succeed(false))

/** Creates an input service fake that fires a single mouse-button click (0 = left, 2 = right). */
export const makeClickInputService = (
  button: number,
  pressedKeys: MutableHashSet.MutableHashSet<string> = MutableHashSet.empty(),
) => buildInputService(pressedKeys, (btn) => Effect.succeed(btn === button), (_btn) => Effect.succeed(false))

/** Creates an input service fake that holds a mouse button down (0 = left). */
export const makeMouseDownInputService = (
  button: number,
  pressedKeys: MutableHashSet.MutableHashSet<string> = MutableHashSet.empty(),
) => buildInputService(pressedKeys, (_btn) => Effect.succeed(false), (btn) => Effect.succeed(btn === button))

type BlockHighlightInstance = InstanceType<typeof import('@ts-minecraft/presentation').BlockHighlightService>

/** Creates a block highlight fake with no current target. */
export const makeBlockHighlight = () => ({
  update: (_cam: unknown, _scene: unknown) => Effect.void,
  invalidateCache: () => Effect.void,
  setVisible: (_visible: boolean) => Effect.void,
  getTargetBlock: () => Effect.succeed(Option.none()),
  getTargetHit: () => Effect.succeed(Option.none()),
}) as unknown as BlockHighlightInstance

/** Creates a block highlight fake pointing at a specific block position (or no target when null). */
export const makeTargetBlockHighlight = (
  target: { x: number; y: number; z: number } | null,
  hit: { blockX: number; blockY: number; blockZ: number; normal: { x: number; y: number; z: number } } | null = null,
) => ({
  update: (_cam: unknown, _scene: unknown) => Effect.void,
  invalidateCache: () => Effect.void,
  setVisible: (_visible: boolean) => Effect.void,
  getTargetBlock: () => Effect.succeed(target ? Option.some(target) : Option.none()),
  getTargetHit: () => Effect.succeed(hit ? Option.some(hit) : Option.none()),
}) as unknown as BlockHighlightInstance

/** Creates a hotbar renderer fake with no-op update and render methods. */
export const makeHotbarRenderer = () => ({
  update: (_slots: unknown, _sel: unknown) => Effect.void,
  render: (_renderer: unknown) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/presentation').HotbarRendererService>

/** Creates a debug feature flag service fake backed by mutable in-memory flags. */
export const makeDebugFeatureFlags = () => {
  const debugFlagsState = { current: { ...DEBUG_FEATURE_FLAG_DEFAULTS } }
  const resetDebugFeatureGroup = (group: DebugFeatureFlagGroup): Effect.Effect<void, never> =>
    Effect.sync(() => {
      const overrides = Object.fromEntries(
        DEBUG_FEATURE_FLAG_CATALOG
          .filter((entry) => entry.group === group)
          .map((entry) => [entry.id, DEBUG_FEATURE_FLAG_DEFAULTS[entry.id]] as const)
      )
      debugFlagsState.current = { ...debugFlagsState.current, ...overrides }
    })

  return {
    catalog: DEBUG_FEATURE_FLAG_CATALOG,
    getSnapshot: () => Effect.succeed({
      catalog: DEBUG_FEATURE_FLAG_CATALOG,
      flags: { ...debugFlagsState.current },
    }),
    getFlags: () => Effect.succeed({ ...debugFlagsState.current }),
    isEnabled: (id: DebugFeatureFlagId) => Effect.succeed(debugFlagsState.current[id]),
    setEnabled: (id: DebugFeatureFlagId, enabled: boolean) =>
      Effect.sync(() => {
        const changed = debugFlagsState.current[id] !== enabled
        debugFlagsState.current = { ...debugFlagsState.current, [id]: enabled }
        return changed
      }),
    resetAll: () => Effect.sync(() => {
      debugFlagsState.current = { ...DEBUG_FEATURE_FLAG_DEFAULTS }
    }),
    resetGroup: resetDebugFeatureGroup,
  } as unknown as InstanceType<typeof import('@ts-minecraft/app/application/debug-feature-flags').DebugFeatureFlagsService>
}

/** Creates an FPS counter fake pinned to 60 FPS and zero frames. */
export const makeFPSCounter = () => ({
  tick: (_dt: unknown) => Effect.void,
  getFPS: () => Effect.succeed(60),
  getFrameCount: () => Effect.succeed(0),
  reset: () => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/presentation').FPSCounterService>

/** Creates a furnace service fake with no active or nearby furnace state. */
export const makeFurnaceService = () => ({
  getState: () => Effect.succeed({ active: Option.none() }),
  getNearestFurnaceState: () => Effect.succeed(Option.none()),
  hasNearbyFurnace: () => Effect.succeed(false),
  setSelectedFurnace: (_position: unknown) => Effect.void,
  startSmelting: (_recipeId: unknown) => Effect.void,
  collectOutput: () => Effect.succeed(true),
  clearFurnace: (_position: unknown) => Effect.succeed([]),
  dismantleFurnace: (_position: unknown) => Effect.succeed(true),
  serialize: () => Effect.succeed([]),
  deserialize: (_serialized: unknown) => Effect.void,
  tick: (_deltaTime: unknown) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/inventory').FurnaceService>

export const makeChestService = () => ({
  getState: () => Effect.succeed({ chests: HashMap.empty(), selectedChestPosition: Option.none() }),
  getNearestChestState: () => Effect.succeed(Option.none()),
  hasNearbyChest: () => Effect.succeed(false),
  setSelectedChest: (_position: unknown) => Effect.void,
  moveInventoryStackToChestSlot: (_inventoryIndex: unknown, _chestIndex: unknown) => Effect.void,
  moveChestStackToInventorySlot: (_chestIndex: unknown, _inventoryIndex: unknown) => Effect.void,
  quickMoveInventoryToChest: (_inventoryIndex: unknown) => Effect.void,
  quickMoveChestToInventory: (_chestIndex: unknown) => Effect.void,
  clearChest: (_position: unknown) => Effect.succeed([]),
  dismantleChest: (_position: unknown) => Effect.succeed(true),
  serialize: () => Effect.succeed([]),
  deserialize: (_serialized: unknown) => Effect.void,
}) as unknown as InstanceType<typeof import('@ts-minecraft/inventory').ChestService>
