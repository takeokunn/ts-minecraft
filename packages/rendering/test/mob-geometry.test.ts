import { describe, it } from '@effect/vitest'
import { expect } from 'vitest'
import * as THREE from 'three'
import { Option } from 'effect'
import { buildMobGroup } from '@ts-minecraft/rendering'

describe('mob-geometry', () => {
  describe('buildMobGroup(Zombie)', () => {
    it('returns a Group with 6 children: head, body, two arms, two legs', () => {
      const g = buildMobGroup('Zombie')
      expect(g.root).toBeInstanceOf(THREE.Group)
      expect(g.root.children.length).toBe(6)
      expect(g.armL).not.toBeNull()
      expect(g.armR).not.toBeNull()
      expect(g.legBL).toBeNull()
      expect(g.legBR).toBeNull()
    })

    it('uses the expected biped colors (head=skin, body=torso, limbs=skin)', () => {
      const g = buildMobGroup('Zombie')
      const headMat = g.head.material as THREE.MeshStandardMaterial
      const bodyMat = g.body.material as THREE.MeshStandardMaterial
      const armMat = (Option.getOrThrow(Option.fromNullable(g.armL)).material) as THREE.MeshStandardMaterial
      const legMat = g.legFL.material as THREE.MeshStandardMaterial
      expect(headMat.color.getHex()).toBe(0x5a8a3a)
      expect(bodyMat.color.getHex()).toBe(0x3f5e7a)
      expect(armMat.color.getHex()).toBe(0x5a8a3a)
      expect(legMat.color.getHex()).toBe(0x5a8a3a)
    })
  })

  describe('buildMobGroup(Pig)', () => {
    it('returns a Group with 6 children: head, body, four legs (no arms)', () => {
      const g = buildMobGroup('Pig')
      expect(g.root.children.length).toBe(6)
      expect(g.armL).toBeNull()
      expect(g.armR).toBeNull()
      expect(g.legBL).not.toBeNull()
      expect(g.legBR).not.toBeNull()
    })

    it('uses the all-pink palette', () => {
      const g = buildMobGroup('Pig')
      const head = (g.head.material as THREE.MeshStandardMaterial).color.getHex()
      const body = (g.body.material as THREE.MeshStandardMaterial).color.getHex()
      const leg = (g.legFL.material as THREE.MeshStandardMaterial).color.getHex()
      expect(head).toBe(0xf0a0a0)
      expect(body).toBe(0xf0a0a0)
      expect(leg).toBe(0xf0a0a0)
    })
  })

  describe('buildMobGroup(Cow)', () => {
    it('uses the cow palette (brown body, white legs)', () => {
      const g = buildMobGroup('Cow')
      const body = (g.body.material as THREE.MeshStandardMaterial).color.getHex()
      const leg = (g.legFL.material as THREE.MeshStandardMaterial).color.getHex()
      expect(body).toBe(0x4a3020)
      expect(leg).toBe(0xf0f0f0)
    })
  })

  describe('buildMobGroup(Sheep)', () => {
    it('uses the sheep palette (white body, tan head/legs)', () => {
      const g = buildMobGroup('Sheep')
      const body = (g.body.material as THREE.MeshStandardMaterial).color.getHex()
      const head = (g.head.material as THREE.MeshStandardMaterial).color.getHex()
      const leg = (g.legFL.material as THREE.MeshStandardMaterial).color.getHex()
      expect(body).toBe(0xf5f5f5)
      expect(head).toBe(0xf0d8b0)
      expect(leg).toBe(0xf0d8b0)
    })
  })

  describe('buildMobGroup(Chicken)', () => {
    it('returns a small quadruped with white body and orange legs', () => {
      const g = buildMobGroup('Chicken')
      const body = (g.body.material as THREE.MeshStandardMaterial).color.getHex()
      const leg = (g.legFL.material as THREE.MeshStandardMaterial).color.getHex()
      expect(g.root.children.length).toBe(6)
      expect(g.armL).toBeNull()
      expect(g.armR).toBeNull()
      expect(g.legBL).not.toBeNull()
      expect(g.legBR).not.toBeNull()
      expect(body).toBe(0xf5f5f5)
      expect(leg).toBe(0xe0a020)
    })
  })

  describe('buildMobGroup(Bat)', () => {
    it('returns a small dark quadruped placeholder', () => {
      const g = buildMobGroup('Bat')
      const head = (g.head.material as THREE.MeshStandardMaterial).color.getHex()
      const body = (g.body.material as THREE.MeshStandardMaterial).color.getHex()
      expect(g.root.children.length).toBe(6)
      expect(g.armL).toBeNull()
      expect(g.armR).toBeNull()
      expect(g.legBL).not.toBeNull()
      expect(g.legBR).not.toBeNull()
      expect(head).toBe(0x2b2420)
      expect(body).toBe(0x1f1a17)
    })
  })

  describe('buildMobGroup(Squid)', () => {
    it('returns a blue quadruped placeholder with tentacle roles', () => {
      const g = buildMobGroup('Squid')
      const body = (g.body.material as THREE.MeshStandardMaterial).color.getHex()
      const leg = (g.legFL.material as THREE.MeshStandardMaterial).color.getHex()
      expect(g.root.children.length).toBe(6)
      expect(g.armL).toBeNull()
      expect(g.armR).toBeNull()
      expect(g.legBL).not.toBeNull()
      expect(g.legBR).not.toBeNull()
      expect(body).toBe(0x2f78b7)
      expect(leg).toBe(0x1f4f7a)
    })
  })

  describe('shared geometry / materials', () => {
    it('reuses the SAME BoxGeometry instances across mobs of the same type', () => {
      const a = buildMobGroup('Zombie')
      const b = buildMobGroup('Zombie')
      expect(a.head.geometry).toBe(b.head.geometry)
      expect(a.body.geometry).toBe(b.body.geometry)
      expect(a.legFL.geometry).toBe(b.legFL.geometry)
      const aArm = Option.getOrThrow(Option.fromNullable(a.armL))
      const bArm = Option.getOrThrow(Option.fromNullable(b.armL))
      expect(aArm.geometry).toBe(bArm.geometry)
    })

    it('reuses the SAME MeshStandardMaterial across mobs of the same type', () => {
      const a = buildMobGroup('Pig')
      const b = buildMobGroup('Pig')
      expect(a.body.material).toBe(b.body.material)
      expect(a.legFL.material).toBe(b.legFL.material)
    })

    it('quadruped front- and back-leg meshes share the same leg geometry', () => {
      const g = buildMobGroup('Cow')
      const fl = g.legFL.geometry
      const fr = g.legFR.geometry
      const bl = Option.getOrThrow(Option.fromNullable(g.legBL)).geometry
      const br = Option.getOrThrow(Option.fromNullable(g.legBR)).geometry
      expect(fl).toBe(fr)
      expect(fl).toBe(bl)
      expect(fl).toBe(br)
    })
  })
})

describe('buildMobGroup — additional mob types', () => {
  it('builds a Creeper (quadruped) without error', () => {
    const g = buildMobGroup('Creeper')
    expect(g.head).toBeDefined()
    expect(g.body).toBeDefined()
    expect(g.legFL).toBeDefined()
  })

  it('builds a Skeleton (biped) without error', () => {
    const g = buildMobGroup('Skeleton')
    expect(g.head).toBeDefined()
    expect(g.body).toBeDefined()
    expect(g.legFL).toBeDefined()
    expect(g.armL).toBeDefined()
  })

  it('builds a Spider (quadruped) without error', () => {
    const g = buildMobGroup('Spider')
    expect(g.head).toBeDefined()
    expect(g.body).toBeDefined()
    expect(g.legFL).toBeDefined()
  })

  it('builds an Enderman (biped) without error', () => {
    const g = buildMobGroup('Enderman')
    expect(g.head).toBeDefined()
    expect(g.body).toBeDefined()
    expect(g.legFL).toBeDefined()
    expect(g.armL).toBeDefined()
  })

  it('builds a Witch (biped) without error', () => {
    const g = buildMobGroup('Witch')
    expect(g.head).toBeDefined()
    expect(g.body).toBeDefined()
    expect(g.legFL).toBeDefined()
    expect(g.armL).toBeDefined()
  })

  it('builds a Drowned (biped) without error', () => {
    const g = buildMobGroup('Drowned')
    expect(g.head).toBeDefined()
    expect(g.body).toBeDefined()
    expect(g.legFL).toBeDefined()
    expect(g.armL).toBeDefined()
  })

  it('builds a Zombie Villager (biped) without error', () => {
    const g = buildMobGroup('ZombieVillager')
    expect(g.head).toBeDefined()
    expect(g.body).toBeDefined()
    expect(g.legFL).toBeDefined()
    expect(g.armL).toBeDefined()
  })
})
