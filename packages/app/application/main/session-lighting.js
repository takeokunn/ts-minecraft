import { Effect, Option, Schema } from 'effect';
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { StartupError } from '@ts-minecraft/game';
import { CHUNK_SIZE, CHUNK_HEIGHT } from '@ts-minecraft/kernel';
import { MAX_SHADOW_HALF_EXTENT, SkyMaterialPortSchema } from '@ts-minecraft/kernel';
import { SUN_COLOR, AMBIENT_COLOR, SKY_COLOR_NIGHT, SKY_COLOR_DAY, } from '@ts-minecraft/app/main.config';
export const buildLighting = (scene, sceneService, initialSettings, initialGraphics) => Effect.gen(function* () {
    const light = yield* Effect.sync(() => {
        const l = new THREE.DirectionalLight(SUN_COLOR, 1);
        l.shadow.mapSize.width = 2048;
        l.shadow.mapSize.height = 2048;
        l.shadow.camera.near = 0.5;
        l.shadow.camera.far = Math.max(initialSettings.renderDistance * CHUNK_SIZE * 1.5 + CHUNK_HEIGHT, 300);
        const shadowHalfExtent = Math.min(Math.ceil(initialSettings.renderDistance * CHUNK_SIZE * 0.5), MAX_SHADOW_HALF_EXTENT);
        l.shadow.camera.left = -shadowHalfExtent;
        l.shadow.camera.right = shadowHalfExtent;
        l.shadow.camera.top = shadowHalfExtent;
        l.shadow.camera.bottom = -shadowHalfExtent;
        l.position.set(5, 10, 7);
        l.castShadow = initialGraphics.shadowsEnabled;
        return l;
    });
    yield* sceneService.add(scene, light);
    yield* sceneService.add(scene, light.target);
    const ambientLight = yield* Effect.sync(() => new THREE.AmbientLight(AMBIENT_COLOR, 0.35));
    yield* sceneService.add(scene, ambientLight);
    const sky = yield* Effect.sync(() => {
        const s = new Sky();
        s.scale.setScalar(10000);
        return s;
    });
    yield* sceneService.add(scene, sky);
    const skyShaderMaterial = yield* Effect.sync(() => {
        const skyMaterial = Array.isArray(sky.material) ? sky.material[0] : sky.material;
        if (!(skyMaterial instanceof THREE.ShaderMaterial)) {
            throw new StartupError({ reason: 'Sky material is not a ShaderMaterial' });
        }
        const mat = skyMaterial;
        Option.map(Option.fromNullable(mat.uniforms['mieCoefficient']), (u) => { u.value = 0.005; });
        Option.map(Option.fromNullable(mat.uniforms['mieDirectionalG']), (u) => { u.value = 0.7; });
        return mat;
    });
    const skyPort = yield* Schema.decodeUnknown(SkyMaterialPortSchema)({
        uniforms: {
            sunPosition: skyShaderMaterial.uniforms['sunPosition'],
            turbidity: skyShaderMaterial.uniforms['turbidity'],
            rayleigh: skyShaderMaterial.uniforms['rayleigh'],
        },
    });
    const { skyNight, skyDay, skyCurrent } = yield* Effect.sync(() => ({
        skyNight: new THREE.Color(SKY_COLOR_NIGHT),
        skyDay: new THREE.Color(SKY_COLOR_DAY),
        skyCurrent: new THREE.Color(),
    }));
    return { light, ambientLight, sky, skyPort, skyNight, skyDay, skyCurrent };
});
//# sourceMappingURL=../../../../dist/packages/app/application/main/session-lighting.js.map