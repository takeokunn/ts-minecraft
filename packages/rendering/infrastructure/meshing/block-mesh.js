import { Array as Arr, Effect, Ref, HashMap, Option } from 'effect';
import * as THREE from 'three';
import { MaterialCacheKey } from '@ts-minecraft/kernel';
export class BlockMeshService extends Effect.Service()('@minecraft/infrastructure/three/BlockMeshService', {
    scoped: Effect.all([
        Effect.acquireRelease(Effect.sync(() => new THREE.BoxGeometry(1, 1, 1)), (geo) => Effect.sync(() => geo.dispose())),
        Ref.make(HashMap.empty()),
    ], { concurrency: 'unbounded' }).pipe(Effect.flatMap(([sharedGeometry, materialCache]) => {
        const createMaterial = (colorOrUrl) => Effect.gen(function* () {
            const cacheKey = MaterialCacheKey.make(colorOrUrl);
            return yield* Option.match(HashMap.get(yield* Ref.get(materialCache), cacheKey), {
                onSome: Effect.succeed,
                onNone: () => Effect.gen(function* () {
                    const material = yield* Effect.sync(() => new THREE.MeshLambertMaterial({
                        color: typeof colorOrUrl === 'string' ? colorOrUrl : colorOrUrl,
                    }));
                    yield* Ref.update(materialCache, (c) => HashMap.set(c, cacheKey, material));
                    return material;
                }),
            });
        });
        return Effect.acquireRelease(Effect.void, () => Effect.gen(function* () {
            const cache = yield* Ref.get(materialCache);
            yield* Effect.sync(() => {
                Arr.forEach(Arr.fromIterable(HashMap.values(cache)), (mat) => mat.dispose());
            });
        })).pipe(Effect.as({
            createSolidBlockMesh: (color, position) => Effect.gen(function* () {
                const material = yield* createMaterial(color);
                return yield* Effect.sync(() => {
                    const mesh = new THREE.Mesh(sharedGeometry, material);
                    mesh.position.copy(position);
                    return mesh;
                });
            }),
            getSharedGeometry: () => Effect.succeed(sharedGeometry),
            disposeMesh: (mesh) => Effect.gen(function* () {
                if (mesh.material) {
                    const materials = Array.isArray(mesh.material)
                        ? mesh.material
                        : [mesh.material];
                    yield* Effect.forEach(materials, (mat) => Effect.gen(function* () {
                        const cache = yield* Ref.get(materialCache);
                        const cacheKeyOpt = Option.map(Arr.findFirst(Arr.fromIterable(cache), ([, m]) => m === mat), ([k]) => k);
                        yield* Option.match(cacheKeyOpt, {
                            onNone: () => Effect.sync(() => mat.dispose()),
                            onSome: () => Effect.void,
                        });
                    }), { concurrency: 1 });
                }
            }),
            disposeAll: () => Effect.gen(function* () {
                const cache = yield* Ref.get(materialCache);
                yield* Effect.sync(() => {
                    Arr.forEach(Arr.fromIterable(HashMap.values(cache)), (material) => material.dispose());
                });
                yield* Ref.set(materialCache, HashMap.empty());
            }),
        }));
    })),
}) {
}
export const BlockMeshServiceLive = BlockMeshService.Default;
//# sourceMappingURL=../../../../dist/packages/rendering/infrastructure/meshing/block-mesh.js.map