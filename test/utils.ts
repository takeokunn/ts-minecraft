import { Effect, Layer, Ref } from 'effect'
import { Archetype } from '@/domain/archetypes'
import { ComponentName, Components, ComponentSchemas } from '@/domain/components'
import { EntityId } from '@/domain/entity'
import { Query } from '@/domain/query'
import { ThreeCameraService } from '@/infrastructure/camera-three'
import { RaycastService } from '@/infrastructure/raycast-three'
import { ThreeContext, ThreeContextService } from '@/infrastructure/types'
import { World } from '@/runtime/world'
import {
  World as WorldPure,
  addArchetype as addArchetypePure,
  createWorld,
  getComponent as getComponentPure,
  query as queryPure,
  querySoA as querySoAPure,
  removeEntity as removeEntityPure,
  updateComponent as updateComponentPure,
} from '@/runtime/world-pure'
import { Scene } from 'three'
import { mock } from 'vitest-mock-extended'

export const provideTestWorld = (
  initialState?: WorldPure,
  mockOverrides?: {
    raycast?: RaycastService
    camera?: ThreeCameraService
    context?: ThreeContext
  },
) => {
  const raycastMock = mockOverrides?.raycast ?? mock<RaycastService>()
  const cameraMock = mockOverrides?.camera ?? mock<ThreeCameraService>()
  const contextMock =
    mockOverrides?.context ??
    ({
      ...mock<ThreeContext>(),
      scene: new Scene(),
    } as ThreeContext)

  const mocksLayer = Layer.mergeAll(Layer.succeed(RaycastService, raycastMock), Layer.succeed(ThreeCameraService, cameraMock), Layer.succeed(ThreeContextService, contextMock))

  // WorldLive の実装をここに展開し、worldStateRef の初期値だけを変える
  const testWorldLayer = Layer.effect(
    World,
    Effect.gen(function* (_) {
      const worldStateRef = yield* Ref.make(initialState ?? createWorld()) // 初期値を使う

      // 以下、WorldLive と同じ実装
      const modify = <A>(f: (world: WorldPure) => readonly [A, WorldPure]) => Ref.modify(worldStateRef, f)
      const update = (f: (world: WorldPure) => WorldPure) => Ref.update(worldStateRef, f)
      const addArchetype = (archetype: Archetype) => modify((world) => addArchetypePure(world, archetype))
      const removeEntity = (id: EntityId) => update((world) => removeEntityPure(world, id))
      const getComponent = <T extends ComponentName>(entityId: EntityId, componentName: T) =>
        Effect.map(Ref.get(worldStateRef), (world) => getComponentPure(world, entityId, componentName))
      const updateComponent = <T extends ComponentName>(entityId: EntityId, componentName: T, componentData: Components[T]) =>
        update((world) => updateComponentPure(world, entityId, componentName, componentData))
      const query = <T extends ReadonlyArray<ComponentName>>(queryDef: Query) => Effect.map(Ref.get(worldStateRef), (world) => queryPure<T>(world, queryDef))
      const querySoA = <T extends ReadonlyArray<ComponentName>>(queryDef: Query) => Effect.map(Ref.get(worldStateRef), (world) => querySoAPure<T>(world, queryDef, ComponentSchemas))

      return {
        state: worldStateRef,
        addArchetype,
        removeEntity,
        getComponent,
        updateComponent,
        query,
        querySoA,
        modify,
        update,
      }
    }),
  )

  // mocksLayer は testWorldLayer には不要だが、テスト対象のシステムが直接依存しているため必要
  return Layer.merge(testWorldLayer, mocksLayer)
}
