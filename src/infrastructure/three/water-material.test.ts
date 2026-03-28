import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Option } from 'effect'
import { createWaterMaterial } from './water-material'

describe('createWaterMaterial', () => {
  const fakeTexture = {} as THREE.Texture

  it('returns a THREE.ShaderMaterial', () => {
    const mat = createWaterMaterial(fakeTexture, 800, 600)
    expect(mat).toBeInstanceOf(THREE.ShaderMaterial)
  })

  it('has transparent: true', () => {
    const mat = createWaterMaterial(fakeTexture, 800, 600)
    expect(mat.transparent).toBe(true)
  })

  it('has depthWrite: false', () => {
    const mat = createWaterMaterial(fakeTexture, 800, 600)
    expect(mat.depthWrite).toBe(false)
  })

  it('has side === THREE.FrontSide', () => {
    const mat = createWaterMaterial(fakeTexture, 800, 600)
    expect(mat.side).toBe(THREE.FrontSide)
  })

  it('uniform uTime is initialized to 0.0', () => {
    const mat = createWaterMaterial(fakeTexture, 800, 600)
    expect(Option.getOrThrow(Option.fromNullable(mat.uniforms['uTime'])).value).toBe(0.0)
  })

  it('uniform uRefractionMap.value equals the passed texture', () => {
    const mat = createWaterMaterial(fakeTexture, 800, 600)
    expect(Option.getOrThrow(Option.fromNullable(mat.uniforms['uRefractionMap'])).value).toBe(fakeTexture)
  })

  it('uniform uResolution.value.x equals width and .y equals height', () => {
    const mat = createWaterMaterial(fakeTexture, 1280, 720)
    const resolution = Option.getOrThrow(Option.fromNullable(mat.uniforms['uResolution'])).value as THREE.Vector2
    expect(resolution.x).toBe(1280)
    expect(resolution.y).toBe(720)
  })

  it('uniform uCameraPosition.value is a THREE.Vector3 initialized to origin', () => {
    const mat = createWaterMaterial(fakeTexture, 800, 600)
    const camPos = Option.getOrThrow(Option.fromNullable(mat.uniforms['uCameraPosition'])).value
    expect(camPos).toBeInstanceOf(THREE.Vector3)
    expect((camPos as THREE.Vector3).x).toBe(0)
    expect((camPos as THREE.Vector3).y).toBe(0)
    expect((camPos as THREE.Vector3).z).toBe(0)
  })
})
