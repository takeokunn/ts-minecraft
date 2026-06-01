import { HashMap, Option } from 'effect'
import type { FurnaceBlockState } from './furnace-state'

// ── State types ──────────────────────────────────────────────────────────────

export type FurnaceState = {
  readonly furnaces: HashMap.HashMap<string, FurnaceBlockState>
  readonly selectedFurnacePosition: Option.Option<{ readonly x: number; readonly y: number; readonly z: number }>
}

// ── Constants ────────────────────────────────────────────────────────────────

export const INITIAL_STATE: FurnaceState = {
  furnaces: HashMap.empty<string, FurnaceBlockState>(),
  selectedFurnacePosition: Option.none(),
}

// ── Pure helper functions ────────────────────────────────────────────────────

export const furnaceKey = (position: { readonly x: number; readonly y: number; readonly z: number }): string => `${position.x},${position.y},${position.z}`

export const positiveModulo = (value: number, divisor: number): number => ((value % divisor) + divisor) % divisor

export const emptyFurnaceAtPosition = (position: { readonly x: number; readonly y: number; readonly z: number }): FurnaceBlockState => ({
  position,
  input: Option.none(),
  fuel: Option.none(),
  output: Option.none(),
  activeRecipeId: Option.none(),
  progressSecs: 0,
})

export const setFurnaceState = (
  state: FurnaceState,
  furnace: FurnaceBlockState,
): FurnaceState => ({
  furnaces: HashMap.set(state.furnaces, furnaceKey(furnace.position), furnace),
  selectedFurnacePosition: state.selectedFurnacePosition,
})
