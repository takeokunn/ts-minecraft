import { Effect, Ref, Option, HashMap, Array as Arr } from 'effect';
import * as THREE from 'three';
import { TextureError } from '../../domain/errors';
import { TextureUrl } from '@ts-minecraft/kernel';
export class TextureService extends Effect.Service()('@minecraft/infrastructure/three/TextureService', {
    effect: Ref.make(HashMap.empty()).pipe(Effect.map((textureCache) => {
        const loadEffect = (url) => {
            const textureUrl = TextureUrl.make(url);
            return Effect.gen(function* () {
                return yield* Option.match(HashMap.get(yield* Ref.get(textureCache), textureUrl), {
                    onSome: Effect.succeed,
                    onNone: () => Effect.tryPromise({
                        try: async () => {
                            const loader = new THREE.TextureLoader();
                            const texture = await loader.loadAsync(url);
                            texture.magFilter = THREE.NearestFilter;
                            texture.minFilter = THREE.NearestFilter;
                            texture.generateMipmaps = false;
                            texture.wrapS = THREE.RepeatWrapping;
                            texture.wrapT = THREE.RepeatWrapping;
                            return texture;
                        },
                        catch: (cause) => new TextureError({ url, cause }),
                    }).pipe(Effect.tap((texture) => Ref.update(textureCache, (cache) => HashMap.set(cache, textureUrl, texture)))),
                });
            });
        };
        return {
            load: loadEffect,
            createSolidColor: (color) => Effect.gen(function* () {
                const result = yield* Effect.sync(() => {
                    const canvas = document.createElement('canvas');
                    canvas.width = 64;
                    canvas.height = 64;
                    const context = canvas.getContext('2d');
                    return { canvas, context };
                });
                const { canvas, context } = result;
                if (!context) {
                    return yield* Effect.fail(new TextureError({ url: 'solid-color-canvas', cause: 'Failed to create canvas context' }));
                }
                return yield* Effect.sync(() => {
                    context.fillStyle = typeof color === 'string' ? color : `#${color.toString(16).padStart(6, '0')}`;
                    context.fillRect(0, 0, 64, 64);
                    const texture = new THREE.CanvasTexture(canvas);
                    texture.magFilter = THREE.NearestFilter;
                    texture.minFilter = THREE.NearestFilter;
                    texture.generateMipmaps = false;
                    return texture;
                });
            }),
            getCached: (url) => Ref.get(textureCache).pipe(Effect.map((cache) => HashMap.get(cache, TextureUrl.make(url)))),
            preload: (urls) => Effect.forEach(urls, (url) => Effect.ignore(loadEffect(url)), { concurrency: 'unbounded' }),
            dispose: () => Effect.gen(function* () {
                const cache = yield* Ref.get(textureCache);
                yield* Effect.sync(() => {
                    Arr.forEach(Arr.fromIterable(HashMap.values(cache)), (texture) => texture.dispose());
                });
                yield* Ref.set(textureCache, HashMap.empty());
            }),
        };
    })),
}) {
}
export const TextureServiceLive = TextureService.Default;
//# sourceMappingURL=../../../../dist/packages/rendering/infrastructure/textures/texture-loader.js.map