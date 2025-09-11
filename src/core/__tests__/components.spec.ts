import { describe, it, expect } from 'vitest'
import * as S from '@effect/schema/Schema'
import {
  PositionComponent,
  VelocityComponent,
  AccelerationComponent,
  MassComponent,
  ColliderComponent,
  createPosition,
  createVelocity,
  createAcceleration,
  createMass,
  createBoxCollider,
  createSphereCollider,
  PhysicsComponents,
  PhysicsComponentFactories
} from '../components/physics'
import {
  HealthComponent,
  InventoryComponent,
  PlayerControllerComponent,
  AIComponent,
  TargetComponent,
  createHealth,
  createInventory,
  createPlayerController,
  createAIComponent,
  createTargetComponent,
  GameplayComponents,
  GameplayComponentFactories
} from '../components/gameplay'
import {
  MeshComponent,
  MaterialComponent,
  LightComponent,
  CameraComponent,
  TransformComponent,
  createMeshComponent,
  createMaterialComponent,
  createLightComponent,
  createCameraComponent,
  createTransformComponent,
  RenderingComponents,
  RenderingComponentFactories
} from '../components/rendering'

describe('Physics Components', () => {
  describe('PositionComponent', () => {
    it('should create valid position component', () => {
      const pos = createPosition(1, 2, 3)
      expect(pos.x).toBe(1)
      expect(pos.y).toBe(2)
      expect(pos.z).toBe(3)
      expect(pos.dirty).toBe(true)
      expect(pos.lastUpdated).toBeTypeOf('number')
    })

    it('should validate schema', () => {
      const valid = { x: 1, y: 2, z: 3 }
      const parsed = S.decodeUnknownSync(PositionComponent)(valid)
      expect(parsed.x).toBe(1)
      expect(parsed.y).toBe(2)
      expect(parsed.z).toBe(3)
    })

    it('should reject invalid data', () => {
      const invalid = { x: 'not a number', y: 2, z: 3 }
      expect(() => S.decodeUnknownSync(PositionComponent)(invalid)).toThrow()
    })
  })

  describe('VelocityComponent', () => {
    it('should create velocity with defaults', () => {
      const vel = createVelocity()
      expect(vel.x).toBe(0)
      expect(vel.y).toBe(0)
      expect(vel.z).toBe(0)
    })

    it('should create velocity with options', () => {
      const vel = createVelocity(1, 2, 3, { damping: 0.5, maxMagnitude: 10 })
      expect(vel.x).toBe(1)
      expect(vel.y).toBe(2)
      expect(vel.z).toBe(3)
      expect(vel.damping).toBe(0.5)
      expect(vel.maxMagnitude).toBe(10)
    })

    it('should validate schema', () => {
      const valid = { x: 1, y: 2, z: 3, damping: 0.5 }
      const parsed = S.decodeUnknownSync(VelocityComponent)(valid)
      expect(parsed.damping).toBe(0.5)
    })

    it('should reject invalid damping', () => {
      const invalid = { x: 1, y: 2, z: 3, damping: 1.5 }
      expect(() => S.decodeUnknownSync(VelocityComponent)(invalid)).toThrow()
    })
  })

  describe('AccelerationComponent', () => {
    it('should create acceleration with force accumulator', () => {
      const acc = createAcceleration(1, 2, 3)
      expect(acc.x).toBe(1)
      expect(acc.y).toBe(2)
      expect(acc.z).toBe(3)
      expect(acc.forceAccumulator).toEqual({ x: 0, y: 0, z: 0 })
    })
  })

  describe('MassComponent', () => {
    it('should create static mass', () => {
      const mass = createMass(100, 'static')
      expect(mass.value).toBe(100)
      expect(mass.inverseMass).toBe(0)
      expect(mass.type).toBe('static')
    })

    it('should create dynamic mass', () => {
      const mass = createMass(10, 'dynamic')
      expect(mass.value).toBe(10)
      expect(mass.inverseMass).toBe(0.1)
      expect(mass.type).toBe('dynamic')
    })

    it('should create kinematic mass', () => {
      const mass = createMass(50, 'kinematic')
      expect(mass.value).toBe(50)
      expect(mass.inverseMass).toBe(0.02)
      expect(mass.type).toBe('kinematic')
    })

    it('should validate mass type', () => {
      const invalid = { value: 10, inverseMass: 0.1, type: 'invalid' }
      expect(() => S.decodeUnknownSync(MassComponent)(invalid)).toThrow()
    })
  })

  describe('ColliderComponent', () => {
    it('should create box collider', () => {
      const collider = createBoxCollider({ x: 1, y: 2, z: 3 })
      expect(collider.shape.type).toBe('box')
      expect((collider.shape as any).halfExtents).toEqual({ x: 1, y: 2, z: 3 })
      expect(collider.restitution).toBe(0.3)
      expect(collider.friction).toBe(0.5)
    })

    it('should create sphere collider', () => {
      const collider = createSphereCollider(5)
      expect(collider.shape.type).toBe('sphere')
      expect((collider.shape as any).radius).toBe(5)
    })

    it('should create collider with custom options', () => {
      const collider = createBoxCollider(
        { x: 1, y: 1, z: 1 },
        { restitution: 0.8, friction: 0.2, layer: 5, mask: 0xFF }
      )
      expect(collider.restitution).toBe(0.8)
      expect(collider.friction).toBe(0.2)
      expect(collider.layer).toBe(5)
      expect(collider.mask).toBe(0xFF)
    })
  })

  describe('PhysicsComponents exports', () => {
    it('should export all physics components', () => {
      expect(PhysicsComponents.Position).toBeDefined()
      expect(PhysicsComponents.Velocity).toBeDefined()
      expect(PhysicsComponents.Acceleration).toBeDefined()
      expect(PhysicsComponents.Mass).toBeDefined()
      expect(PhysicsComponents.Collider).toBeDefined()
    })

    it('should export all physics factories', () => {
      expect(PhysicsComponentFactories.createPosition).toBeDefined()
      expect(PhysicsComponentFactories.createVelocity).toBeDefined()
      expect(PhysicsComponentFactories.createAcceleration).toBeDefined()
      expect(PhysicsComponentFactories.createMass).toBeDefined()
      expect(PhysicsComponentFactories.createBoxCollider).toBeDefined()
      expect(PhysicsComponentFactories.createSphereCollider).toBeDefined()
    })
  })
})

describe('Gameplay Components', () => {
  describe('HealthComponent', () => {
    it('should create health component', () => {
      const health = createHealth(100)
      expect(health.current).toBe(100)
      expect(health.maximum).toBe(100)
      expect(health.regenRate).toBe(0)
      expect(health.isDead).toBe(false)
    })

    it('should create health with options', () => {
      const health = createHealth(100, {
        current: 50,
        regenRate: 5,
        armor: 0.2,
        magicResistance: 0.1
      })
      expect(health.current).toBe(50)
      expect(health.regenRate).toBe(5)
      expect(health.armor).toBe(0.2)
      expect(health.magicResistance).toBe(0.1)
    })

    it('should validate health schema', () => {
      const valid = {
        current: 50,
        maximum: 100,
        regenRate: 1,
        regenDelay: 3,
        armor: 0.5,
        magicResistance: 0.3,
        statusEffects: [],
        isDead: false,
        isInvulnerable: false
      }
      const parsed = S.decodeUnknownSync(HealthComponent)(valid)
      expect(parsed.current).toBe(50)
      expect(parsed.maximum).toBe(100)
    })
  })

  describe('InventoryComponent', () => {
    it('should create empty inventory', () => {
      const inventory = createInventory(10)
      expect(inventory.capacity).toBe(10)
      expect(inventory.items).toEqual([])
      expect(inventory.selectedSlot).toBe(0)
    })

    it('should create inventory with items', () => {
      const items = [
        { slot: 0, itemId: 'sword', quantity: 1, metadata: {} }
      ]
      const inventory = createInventory(10, items)
      expect(inventory.items).toHaveLength(1)
      expect(inventory.items[0].itemId).toBe('sword')
    })
  })

  describe('PlayerControllerComponent', () => {
    it('should create player controller', () => {
      const controller = createPlayerController()
      expect(controller.moveSpeed).toBe(5)
      expect(controller.jumpForce).toBe(10)
      expect(controller.sensitivity).toBe(1)
    })

    it('should create controller with custom settings', () => {
      const controller = createPlayerController({
        moveSpeed: 10,
        jumpForce: 15,
        sensitivity: 0.5,
        canFly: true
      })
      expect(controller.moveSpeed).toBe(10)
      expect(controller.jumpForce).toBe(15)
      expect(controller.canFly).toBe(true)
    })
  })

  describe('AIComponent', () => {
    it('should create idle AI', () => {
      const ai = createAIComponent('idle')
      expect(ai.state).toBe('idle')
      expect(ai.behaviorTree).toBeUndefined()
    })

    it('should create AI with behavior tree', () => {
      const behaviorTree = {
        type: 'selector' as const,
        children: []
      }
      const ai = createAIComponent('patrolling', { behaviorTree })
      expect(ai.state).toBe('patrolling')
      expect(ai.behaviorTree).toBeDefined()
    })
  })

  describe('TargetComponent', () => {
    it('should create target component', () => {
      const target = createTargetComponent('entity', 123)
      expect(target.type).toBe('entity')
      expect(target.entityId).toBe(123)
    })

    it('should create block target', () => {
      const target = createTargetComponent('block', undefined, { x: 1, y: 2, z: 3 })
      expect(target.type).toBe('block')
      expect(target.position).toEqual({ x: 1, y: 2, z: 3 })
    })
  })

  describe('GameplayComponents exports', () => {
    it('should export all gameplay components', () => {
      expect(GameplayComponents.Health).toBeDefined()
      expect(GameplayComponents.Inventory).toBeDefined()
      expect(GameplayComponents.PlayerController).toBeDefined()
      expect(GameplayComponents.AI).toBeDefined()
      expect(GameplayComponents.Target).toBeDefined()
    })

    it('should export all gameplay factories', () => {
      expect(GameplayComponentFactories.createHealth).toBeDefined()
      expect(GameplayComponentFactories.createInventory).toBeDefined()
      expect(GameplayComponentFactories.createPlayerController).toBeDefined()
      expect(GameplayComponentFactories.createAIComponent).toBeDefined()
      expect(GameplayComponentFactories.createTargetComponent).toBeDefined()
    })
  })
})

describe('Rendering Components', () => {
  describe('MeshComponent', () => {
    it('should create box mesh', () => {
      const mesh = createMeshComponent('box', { width: 1, height: 2, depth: 3 })
      expect(mesh.geometry.type).toBe('box')
      expect((mesh.geometry as any).width).toBe(1)
      expect(mesh.visible).toBe(true)
    })

    it('should create sphere mesh', () => {
      const mesh = createMeshComponent('sphere', { radius: 5, segments: 32 })
      expect(mesh.geometry.type).toBe('sphere')
      expect((mesh.geometry as any).radius).toBe(5)
    })

    it('should create mesh with material', () => {
      const mesh = createMeshComponent('box', { width: 1, height: 1, depth: 1 }, 'stone')
      expect(mesh.materialId).toBe('stone')
    })
  })

  describe('MaterialComponent', () => {
    it('should create material', () => {
      const material = createMaterialComponent('stone')
      expect(material.id).toBe('stone')
      expect(material.type).toBe('standard')
      expect(material.color).toEqual({ r: 1, g: 1, b: 1, a: 1 })
    })

    it('should create material with properties', () => {
      const material = createMaterialComponent('gold', {
        type: 'physical',
        color: { r: 1, g: 0.8, b: 0, a: 1 },
        metalness: 1,
        roughness: 0.2
      })
      expect(material.type).toBe('physical')
      expect(material.metalness).toBe(1)
      expect(material.roughness).toBe(0.2)
    })
  })

  describe('LightComponent', () => {
    it('should create point light', () => {
      const light = createLightComponent('point')
      expect(light.type).toBe('point')
      expect(light.intensity).toBe(1)
      expect(light.color).toEqual({ r: 1, g: 1, b: 1 })
    })

    it('should create directional light', () => {
      const light = createLightComponent('directional', {
        intensity: 0.8,
        color: { r: 1, g: 0.9, b: 0.8 },
        castShadows: true
      })
      expect(light.type).toBe('directional')
      expect(light.intensity).toBe(0.8)
      expect(light.castShadows).toBe(true)
    })
  })

  describe('CameraComponent', () => {
    it('should create perspective camera', () => {
      const camera = createCameraComponent('perspective')
      expect(camera.type).toBe('perspective')
      expect(camera.fov).toBe(75)
      expect(camera.near).toBe(0.1)
      expect(camera.far).toBe(1000)
    })

    it('should create orthographic camera', () => {
      const camera = createCameraComponent('orthographic', {
        size: 10,
        near: -100,
        far: 100
      })
      expect(camera.type).toBe('orthographic')
      expect(camera.size).toBe(10)
    })
  })

  describe('TransformComponent', () => {
    it('should create identity transform', () => {
      const transform = createTransformComponent()
      expect(transform.position).toEqual({ x: 0, y: 0, z: 0 })
      expect(transform.rotation).toEqual({ x: 0, y: 0, z: 0, w: 1 })
      expect(transform.scale).toEqual({ x: 1, y: 1, z: 1 })
    })

    it('should create transform with values', () => {
      const transform = createTransformComponent({
        position: { x: 1, y: 2, z: 3 },
        scale: { x: 2, y: 2, z: 2 }
      })
      expect(transform.position).toEqual({ x: 1, y: 2, z: 3 })
      expect(transform.scale).toEqual({ x: 2, y: 2, z: 2 })
    })
  })

  describe('RenderingComponents exports', () => {
    it('should export all rendering components', () => {
      expect(RenderingComponents.Mesh).toBeDefined()
      expect(RenderingComponents.Material).toBeDefined()
      expect(RenderingComponents.Light).toBeDefined()
      expect(RenderingComponents.Camera).toBeDefined()
      expect(RenderingComponents.Transform).toBeDefined()
    })

    it('should export all rendering factories', () => {
      expect(RenderingComponentFactories.createMeshComponent).toBeDefined()
      expect(RenderingComponentFactories.createMaterialComponent).toBeDefined()
      expect(RenderingComponentFactories.createLightComponent).toBeDefined()
      expect(RenderingComponentFactories.createCameraComponent).toBeDefined()
      expect(RenderingComponentFactories.createTransformComponent).toBeDefined()
    })
  })
})