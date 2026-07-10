// Modding API v1: user scripts register plain-object mods on
// `window.__TS_MINECRAFT_MODS__` BEFORE the game boots; the session loads
// them once and dispatches gameplay events into their hooks. Mod code is
// untrusted-but-local: every callback runs inside a try/catch so a broken
// mod logs and is skipped — it can never take the frame loop down.
//
// Module scratch (not an Effect service): the registry is app-global like
// the window it reads from, and handler call sites import the dispatch
// functions directly — no service-plumbing ripple through the frame types.

export type ModBlockEvent = {
  readonly x: number
  readonly y: number
  readonly z: number
  readonly blockType: string
}

// Capabilities handed to mods. Deliberately narrow: reads plus a single
// additive write (give item). Mods never get raw services.
export type ModContext = {
  readonly giveItem: (itemType: string, count: number) => Promise<boolean>
  readonly getPlayerPosition: () => Promise<{ readonly x: number; readonly y: number; readonly z: number } | null>
  readonly getBlockAt: (x: number, y: number, z: number) => Promise<string | null>
  readonly log: (message: string) => void
}

export type ModDefinition = {
  readonly name: string
  readonly version: string
  readonly onInit?: (context: ModContext) => void
  readonly onBlockBreak?: (event: ModBlockEvent, context: ModContext) => void
  readonly onBlockPlace?: (event: ModBlockEvent, context: ModContext) => void
  // Called roughly once per second while a world is running.
  readonly onTick?: (context: ModContext) => void
}

type LoadedMod = { readonly definition: ModDefinition }

let loadedMods: ReadonlyArray<LoadedMod> = []
let activeContext: ModContext | null = null

export const resetModsForTest = (): void => {
  loadedMods = []
  activeContext = null
}

const isValidMod = (candidate: unknown): candidate is ModDefinition => {
  if (typeof candidate !== 'object' || candidate === null) return false
  const mod = candidate as Record<string, unknown>
  if (typeof mod['name'] !== 'string' || mod['name'].length === 0) return false
  if (typeof mod['version'] !== 'string') return false
  for (const hook of ['onInit', 'onBlockBreak', 'onBlockPlace', 'onTick']) {
    if (mod[hook] !== undefined && typeof mod[hook] !== 'function') return false
  }
  return true
}

const runHookSafely = (modName: string, hookName: string, run: () => void): void => {
  try {
    run()
  } catch (error) {
    // A mod error must never propagate into the game loop.
    console.warn(`[mods] ${modName}.${hookName} threw:`, error)
  }
}

// Reads window.__TS_MINECRAFT_MODS__, validates each entry, stores the
// registry, and fires onInit. Returns the loaded mod names (for the boot log
// and tests). Safe to call in non-browser contexts (no window → no mods).
export const loadModsFromWindow = (context: ModContext): ReadonlyArray<string> => {
  activeContext = context
  const holder = (globalThis as { __TS_MINECRAFT_MODS__?: unknown }).__TS_MINECRAFT_MODS__
  if (!Array.isArray(holder)) {
    loadedMods = []
    return []
  }
  const valid: LoadedMod[] = []
  for (const candidate of holder) {
    if (!isValidMod(candidate)) {
      console.warn('[mods] skipping invalid mod registration:', candidate)
      continue
    }
    valid.push({ definition: candidate })
  }
  loadedMods = valid
  for (const mod of valid) {
    if (mod.definition.onInit !== undefined) {
      const onInit = mod.definition.onInit
      runHookSafely(mod.definition.name, 'onInit', () => onInit(context))
    }
  }
  return valid.map((mod) => mod.definition.name)
}

export const getLoadedModNames = (): ReadonlyArray<string> =>
  loadedMods.map((mod) => mod.definition.name)

export const dispatchModBlockBreak = (event: ModBlockEvent): void => {
  const context = activeContext
  if (context === null) return
  for (const mod of loadedMods) {
    const hook = mod.definition.onBlockBreak
    if (hook !== undefined) runHookSafely(mod.definition.name, 'onBlockBreak', () => hook(event, context))
  }
}

export const dispatchModBlockPlace = (event: ModBlockEvent): void => {
  const context = activeContext
  if (context === null) return
  for (const mod of loadedMods) {
    const hook = mod.definition.onBlockPlace
    if (hook !== undefined) runHookSafely(mod.definition.name, 'onBlockPlace', () => hook(event, context))
  }
}

export const dispatchModTick = (): void => {
  const context = activeContext
  if (context === null) return
  for (const mod of loadedMods) {
    const hook = mod.definition.onTick
    if (hook !== undefined) runHookSafely(mod.definition.name, 'onTick', () => hook(context))
  }
}
