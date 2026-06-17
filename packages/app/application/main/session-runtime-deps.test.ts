import { describe, it } from '@effect/vitest'
import { expect, vi } from 'vitest'
import { MutableRef, Option, Ref } from 'effect'
import * as THREE from 'three'
import { assembleFrameHandlerDeps, readSessionHudElements } from '@ts-minecraft/app/main/session-runtime-deps'

describe('session-runtime-deps', () => {
  it('reads the session hud elements from the canonical DOM ids', () => {
    const getElementById = vi.fn(() => null)
    vi.stubGlobal('document', { getElementById })
    const elements = readSessionHudElements()

    expect(elements.fpsElement).toBeNull()
    expect(elements.healthValueElement).toBeNull()
    expect(elements.healthMaxElement).toBeNull()
    expect(elements.hungerValueElement).toBeNull()
    expect(elements.hungerMaxElement).toBeNull()
    expect(elements.xpLevelElement).toBeNull()
    expect(elements.xpBarElement).toBeNull()
    expect(elements.xpBarMaxElement).toBeNull()
    expect(elements.armorValueElement).toBeNull()
    expect(elements.airElement).toBeNull()
    expect(elements.breakProgressElement).toBeNull()

    expect(getElementById).toHaveBeenCalledWith('fps-value')
    expect(getElementById).toHaveBeenCalledWith('health-value')
    expect(getElementById).toHaveBeenCalledWith('health-max')
    expect(getElementById).toHaveBeenCalledWith('hunger-value')
    expect(getElementById).toHaveBeenCalledWith('hunger-max')
    expect(getElementById).toHaveBeenCalledWith('xp-level')
    expect(getElementById).toHaveBeenCalledWith('xp-bar')
    expect(getElementById).toHaveBeenCalledWith('xp-bar-max')
    expect(getElementById).toHaveBeenCalledWith('armor-value')
    expect(getElementById).toHaveBeenCalledWith('air-display')
    expect(getElementById).toHaveBeenCalledWith('break-progress')
  })

  it('assembles frame handler deps from the session runtime params', () => {
    const renderer = { setClearColor: vi.fn() } as unknown as THREE.WebGLRenderer
    const control = { isPausedRef: { paused: true } as unknown as Ref.Ref<boolean> }
    const lighting = {
      light: {} as THREE.DirectionalLight,
      ambientLight: {} as THREE.AmbientLight,
      sky: {} as THREE.Object3D,
      skyPort: { tag: 'sky-port' },
      moonPort: { tag: 'moon-port' },
      skyNight: new THREE.Color(0.1, 0.2, 0.3),
      skyDay: new THREE.Color(0.4, 0.5, 0.6),
      skyCurrent: new THREE.Color(0.7, 0.8, 0.9),
    }
    const params = {
      renderer,
      scene: {} as THREE.Scene,
      camera: {} as THREE.PerspectiveCamera,
      composerRT: {} as never,
      composer: { tag: 'composer' } as never,
      gtaoPass: Option.some({ tag: 'gtao' } as never),
      bloomPass: Option.some({ tag: 'bloom' } as never),
      bokehPass: Option.some({ tag: 'bokeh' } as never),
      godRaysPass: Option.some({ tag: 'god-rays' } as never),
      smaaPass: Option.some({ tag: 'smaa' } as never),
      lighting,
      fpsElement: null,
      healthValueElement: { tag: 'health-value' } as never,
      healthMaxElement: null,
      hungerValueElement: null,
      hungerMaxElement: { tag: 'hunger-max' } as never,
      xpLevelElement: null,
      xpBarElement: { tag: 'xp-bar' } as never,
      xpBarMaxElement: null,
      armorValueElement: { tag: 'armor-value' } as never,
      airElement: null,
      breakProgressElement: { tag: 'break-progress' } as never,
      control: control as never,
      gamePausedRef: { tag: 'game-paused' } as never,
      respawnPositionRef: {} as never,
      pendingResizeRef: MutableRef.make(Option.none()),
      pendingSaveDirtyChunksRef: MutableRef.make(false),
      persistSessionState: () => Option.none() as never,
      deathScreen: {} as never,
      debugOverlay: {} as never,
      biomeService: {} as never,
      recipeService: {} as never,
    } as never

    const deps = assembleFrameHandlerDeps(params)

    expect(renderer.setClearColor).not.toHaveBeenCalled()
    deps.lights.renderer.setClearColor(new THREE.Color(0.25, 0.5, 0.75))
    expect(renderer.setClearColor).toHaveBeenCalledOnce()
    const color = vi.mocked(renderer.setClearColor).mock.calls[0]?.[0] as THREE.Color
    expect(color).toBeInstanceOf(THREE.Color)
    expect(color.r).toBeCloseTo(0.25)
    expect(color.g).toBeCloseTo(0.5)
    expect(color.b).toBeCloseTo(0.75)

    expect(Option.isNone(deps.fpsElement)).toBe(true)
    expect(Option.isSome(deps.healthValueElement)).toBe(true)
    expect(Option.isNone(deps.healthMaxElement)).toBe(true)
    expect(Option.isNone(deps.hungerValueElement)).toBe(true)
    expect(Option.isSome(deps.hungerMaxElement)).toBe(true)
    expect(Option.isNone(deps.xpLevelElement)).toBe(true)
    expect(Option.isSome(deps.xpBarElement)).toBe(true)
    expect(Option.isNone(deps.xpBarMaxElement)).toBe(true)
    expect(Option.isSome(deps.armorValueElement)).toBe(true)
    expect(Option.isNone(deps.airElement)).toBe(true)
    expect(Option.isSome(deps.breakProgressElement)).toBe(true)
    expect(deps.sessionPausedRef).toBe(control.isPausedRef)
    expect(Option.isSome(deps.composer)).toBe(true)
    expect(Option.isSome(deps.lights.sky)).toBe(true)
    expect(Option.isSome(deps.lights.moon)).toBe(true)
    expect(Option.isSome(deps.skyMesh)).toBe(true)
  })
})
