import { describe, expect, it } from 'vitest'
import { resolveFrameMotionState, resolveUpdateFrameContext } from '@ts-minecraft/game/domain/player-motion'
import type { ResolveFrameMotionStateArgs } from '@ts-minecraft/game/domain/player-motion'

// ─── helpers ─────────────────────────────────────────────────────────────────

const DEFAULT_VEC3 = { x: 0, y: 0, z: 0 }

const args = (overrides: Partial<ResolveFrameMotionStateArgs> = {}): ResolveFrameMotionStateArgs => ({
  currentFlying: false,
  isCreative: false,
  isSpectator: false,
  flightTogglePressed: false,
  jumpPressed: false,
  sneakPressed: false,
  isGrounded: true,
  inputVelocity: DEFAULT_VEC3,
  currentVelocity: DEFAULT_VEC3,
  ...overrides,
})

// ─── resolveFrameMotionState ──────────────────────────────────────────────────
describe('resolveFrameMotionState', () => {
  it('returns flying=false and sneaking=false for a grounded survival player', () => {
    const result = resolveFrameMotionState(args())
    expect(result.flying).toBe(false)
    expect(result.sneaking).toBe(false)
  })

  it('spectator mode forces flying=true regardless of toggle state', () => {
    const result = resolveFrameMotionState(args({ isSpectator: true, isCreative: false }))
    expect(result.flying).toBe(true)
  })

  it('creative + toggle press flips flying from false to true', () => {
    const result = resolveFrameMotionState(args({ isCreative: true, flightTogglePressed: true, currentFlying: false }))
    expect(result.flying).toBe(true)
  })

  it('creative + toggle press flips flying from true to false', () => {
    const result = resolveFrameMotionState(args({ isCreative: true, flightTogglePressed: true, currentFlying: true }))
    expect(result.flying).toBe(false)
  })

  it('creative without toggle press preserves current flying state', () => {
    const flying = resolveFrameMotionState(args({ isCreative: true, currentFlying: true, flightTogglePressed: false }))
    expect(flying.flying).toBe(true)
    const notFlying = resolveFrameMotionState(args({ isCreative: true, currentFlying: false, flightTogglePressed: false }))
    expect(notFlying.flying).toBe(false)
  })

  it('survival player ignores flight toggle (non-creative stays grounded)', () => {
    const result = resolveFrameMotionState(args({ isCreative: false, flightTogglePressed: true, currentFlying: false }))
    expect(result.flying).toBe(false)
  })

  it('sneaking is suppressed when flying', () => {
    const result = resolveFrameMotionState(args({ isCreative: true, currentFlying: true, sneakPressed: true }))
    expect(result.sneaking).toBe(false)
  })

  it('sneaking is active for a grounded non-flying player who holds sneak', () => {
    const result = resolveFrameMotionState(args({ sneakPressed: true, isGrounded: true }))
    expect(result.sneaking).toBe(true)
  })

  it('jumped=true when inputVelocity.y > 0', () => {
    const result = resolveFrameMotionState(args({ inputVelocity: { x: 0, y: 1, z: 0 } }))
    expect(result.jumped).toBe(true)
  })

  it('jumped=false when inputVelocity.y is 0', () => {
    const result = resolveFrameMotionState(args({ inputVelocity: DEFAULT_VEC3 }))
    expect(result.jumped).toBe(false)
  })

  it('flightVy is 0 for a non-flying player even when jump is pressed', () => {
    const result = resolveFrameMotionState(args({ jumpPressed: true, isCreative: false }))
    expect(result.flightVy).toBe(0)
  })

  it('flightVy > 0 when flying and only jump is pressed (ascend)', () => {
    const result = resolveFrameMotionState(args({ isCreative: true, currentFlying: true, jumpPressed: true, sneakPressed: false }))
    expect(result.flightVy).toBeGreaterThan(0)
  })

  it('flightVy < 0 when flying and only sneak is pressed (descend)', () => {
    const result = resolveFrameMotionState(args({ isCreative: true, currentFlying: true, jumpPressed: false, sneakPressed: true }))
    expect(result.flightVy).toBeLessThan(0)
  })

  it('flightVy = 0 when flying with both jump and sneak pressed (opposing cancel)', () => {
    const result = resolveFrameMotionState(args({ isCreative: true, currentFlying: true, jumpPressed: true, sneakPressed: true }))
    expect(result.flightVy).toBe(0)
  })
})

// ─── resolveUpdateFrameContext ────────────────────────────────────────────────
describe('resolveUpdateFrameContext', () => {
  it('capturePrePos=true when flying', () => {
    const ctx = resolveUpdateFrameContext(args({ isCreative: true, currentFlying: true }))
    expect(ctx.capturePrePos).toBe(true)
  })

  it('capturePrePos=true when sneaking and grounded', () => {
    const ctx = resolveUpdateFrameContext(args({ sneakPressed: true, isGrounded: true }))
    expect(ctx.capturePrePos).toBe(true)
  })

  it('capturePrePos=false when not flying, not sneaking, on the ground', () => {
    const ctx = resolveUpdateFrameContext(args({ isGrounded: true }))
    expect(ctx.capturePrePos).toBe(false)
  })

  it('capturePrePos=false when sneaking but airborne', () => {
    const ctx = resolveUpdateFrameContext(args({ sneakPressed: true, isGrounded: false }))
    expect(ctx.capturePrePos).toBe(false)
  })

  it('frameMotionState is the same as resolveFrameMotionState for the same args', () => {
    const input = args({ isCreative: true, currentFlying: true, sneakPressed: true })
    const ctx = resolveUpdateFrameContext(input)
    const direct = resolveFrameMotionState(input)
    expect(ctx.frameMotionState).toEqual(direct)
  })
})
