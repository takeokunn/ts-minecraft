import { Array as Arr, Effect, MutableRef, Option } from 'effect';
import * as THREE from 'three';
import { HOTBAR_START } from '@ts-minecraft/inventory';
import { DEFAULT_PLAYER_ID, SlotIndex, RecipeId, BlockTypeSchema } from '@ts-minecraft/kernel';
import { blockTypeToIndex } from '@ts-minecraft/kernel';
import { setBlockInChunk } from '@ts-minecraft/terrain';
import { Schema } from 'effect';
import { EntityType } from '@ts-minecraft/entities';
import { getChunkAccessForWorldPosition, getNormalizedLookDirection, projectBlockAhead, scanNearbyBlock, } from '@ts-minecraft/app/main/qa-spatial';
import { PLAYER_ATTACK_DAMAGE, WOODEN_SWORD_ATTACK_DAMAGE, } from '@ts-minecraft/app/frame-handler.config';
const getUnknownProperty = (value, key) => Reflect.get(value, key);
const isQaChunkCoord = (value) => typeof value === 'object' &&
    value !== null &&
    typeof getUnknownProperty(value, 'x') === 'number' &&
    typeof getUnknownProperty(value, 'z') === 'number';
const isChunkMeshWithCoord = (child) => child instanceof THREE.Mesh && isQaChunkCoord(getUnknownProperty(child.userData, 'chunkCoord'));
const isEnvLike = (value) => typeof value === 'object' &&
    value !== null &&
    (getUnknownProperty(value, 'DEV') === undefined || typeof getUnknownProperty(value, 'DEV') === 'boolean');
const isProcessLike = (value) => {
    if (typeof value !== 'object' || value === null)
        return false;
    const env = getUnknownProperty(value, 'env');
    if (env === undefined)
        return true;
    return (typeof env === 'object' &&
        env !== null &&
        (getUnknownProperty(env, 'NODE_ENV') === undefined || typeof getUnknownProperty(env, 'NODE_ENV') === 'string'));
};
const getMaterialType = (material) => {
    const firstMaterial = Array.isArray(material) ? material[0] : material;
    return firstMaterial?.type ?? 'UnknownMaterial';
};
const isAtlasTextureLoaded = (material) => {
    const firstMaterial = Array.isArray(material) ? material[0] : material;
    return firstMaterial instanceof THREE.MeshLambertMaterial && Boolean(firstMaterial.map?.image);
};
const getChunkMeshSnapshots = (scene) => scene.children
    .filter(isChunkMeshWithCoord)
    .map((mesh) => {
    const position = mesh.geometry.getAttribute('position');
    const uv = mesh.geometry.getAttribute('uv');
    const tileIndex = mesh.geometry.getAttribute('tileIndex');
    return {
        chunkCoord: mesh.userData.chunkCoord,
        type: mesh.type,
        visible: mesh.visible,
        vertexCount: position?.count ?? 0,
        indexCount: mesh.geometry.index?.count ?? 0,
        hasUv: uv !== undefined,
        hasTileIndex: tileIndex !== undefined,
        tileIndexCount: tileIndex?.count ?? 0,
        materialType: getMaterialType(mesh.material),
        textureLoaded: isAtlasTextureLoaded(mesh.material),
    };
});
// ---------------------------------------------------------------------------
// Inventory operations
// ---------------------------------------------------------------------------
const getInventorySnapshot = (inventoryService) => Effect.runPromise(inventoryService.getAllSlots().pipe(Effect.map((slots) => Arr.map(slots, (slot, index) => Option.match(slot, {
    onNone: () => null,
    onSome: (stack) => ({ slot: index, itemType: stack.itemType, count: stack.count }),
})))));
const openInventoryForQA = (inventoryRenderer) => Effect.runPromise(inventoryRenderer.toggle());
const moveItemToHotbar = (inventoryService, hotbarService, itemType, hotbarIndex) => Effect.runPromise(Effect.gen(function* () {
    const slots = yield* inventoryService.getAllSlots();
    const fromIndexOpt = Arr.findFirstIndex(slots, (slot) => Option.match(slot, { onNone: () => false, onSome: (stack) => stack.itemType === itemType }));
    const fromIndex = Option.getOrElse(fromIndexOpt, () => -1);
    if (fromIndex < 0)
        return false;
    yield* inventoryService.moveStack(SlotIndex.make(fromIndex), SlotIndex.make(HOTBAR_START + hotbarIndex));
    yield* hotbarService.setSelectedSlot(SlotIndex.make(hotbarIndex));
    return true;
}));
const selectHotbarSlot = (hotbarService, hotbarIndex) => Effect.runPromise(hotbarService.setSelectedSlot(SlotIndex.make(hotbarIndex)));
const getRecipeButtons = (recipeService) => Arr.map(recipeService.getAllRecipes(), (recipe) => recipe.id);
const craftRecipeForQA = (inventoryService, inventoryRenderer, recipeService, furnaceService, gameState, chunkManagerService, recipeId) => Effect.runPromise(Effect.gen(function* () {
    const getChunkOrNone = (coord) => chunkManagerService.getChunk(coord).pipe(Effect.option);
    const getPlayerPositionForQa = () => gameState.getPlayerPosition(DEFAULT_PLAYER_ID).pipe(Effect.catchAllCause((_cause) => Effect.succeed({ x: 0, y: 0, z: 0 })));
    const scanNearbyCraftingStation = (targetBlockIndex) => inventoryRenderer.isOpen().pipe(Effect.flatMap(() => getPlayerPositionForQa().pipe(Effect.flatMap((playerPos) => scanNearbyBlock(playerPos, 5, targetBlockIndex, getChunkOrNone)))));
    const hasTableAccess = yield* scanNearbyCraftingStation(blockTypeToIndex('CRAFTING_TABLE'));
    const hasFurnaceAccess = yield* scanNearbyCraftingStation(blockTypeToIndex('FURNACE'));
    const recipe = recipeService.findById(RecipeId.make(recipeId));
    yield* Option.match(recipe, {
        onNone: () => recipeService.craft(RecipeId.make(recipeId), inventoryService, hasTableAccess, hasFurnaceAccess),
        onSome: (resolvedRecipe) => resolvedRecipe.station === 'furnace'
            ? furnaceService.getNearestFurnaceState().pipe(Effect.flatMap((furnaceOpt) => Option.match(furnaceOpt, {
                onNone: () => furnaceService.startSmelting(RecipeId.make(recipeId)),
                onSome: (furnace) => Option.match(furnace.output, {
                    onSome: () => furnaceService.collectOutput().pipe(Effect.asVoid),
                    onNone: () => furnaceService.startSmelting(RecipeId.make(recipeId)),
                }),
            })))
            : recipeService.craft(RecipeId.make(recipeId), inventoryService, hasTableAccess, hasFurnaceAccess),
    });
}));
// ---------------------------------------------------------------------------
// Building operations
// ---------------------------------------------------------------------------
const stageProgressionScenario = (camera, scene, chunkManagerService, worldRendererService, blockHighlight, stagedResourceBlocksRef, stagedZombiePositionRef) => Effect.runPromise(Effect.gen(function* () {
    MutableRef.set(stagedResourceBlocksRef, []);
    MutableRef.set(stagedZombiePositionRef, null);
    const placeBlockAhead = (distance, blockType) => Effect.gen(function* () {
        const worldPos = projectBlockAhead(camera, distance);
        const { chunkCoord, lx, lz } = getChunkAccessForWorldPosition(worldPos);
        const chunk = yield* chunkManagerService.getChunk(chunkCoord);
        yield* setBlockInChunk(chunk, lx, worldPos.y, lz, blockType);
        yield* chunkManagerService.markChunkDirty(chunkCoord);
        yield* worldRendererService.updateChunkInScene(chunk, scene).pipe(Effect.catchAllCause(() => Effect.void));
        MutableRef.set(stagedResourceBlocksRef, [...MutableRef.get(stagedResourceBlocksRef), { pos: worldPos, blockType }]);
    });
    yield* placeBlockAhead(4, 'WOOD');
    yield* placeBlockAhead(5, 'WOOD');
    yield* placeBlockAhead(6, 'WOOD');
    yield* blockHighlight.invalidateCache();
}));
const collectStagedResources = (blockService, stagedResourceBlocksRef) => Effect.runPromise(Effect.gen(function* () {
    yield* Effect.forEach(MutableRef.get(stagedResourceBlocksRef), ({ pos }) => blockService.breakBlock(pos), { concurrency: 1, discard: true });
    MutableRef.set(stagedResourceBlocksRef, []);
}));
const stageBuildSupportBlock = (camera, scene, chunkManagerService, worldRendererService, blockHighlight) => Effect.runPromise(Effect.gen(function* () {
    const worldPos = projectBlockAhead(camera, 3);
    const { chunkCoord, lx, lz } = getChunkAccessForWorldPosition(worldPos);
    const chunk = yield* chunkManagerService.getChunk(chunkCoord);
    yield* setBlockInChunk(chunk, lx, worldPos.y, lz, 'STONE');
    yield* chunkManagerService.markChunkDirty(chunkCoord);
    yield* worldRendererService.updateChunkInScene(chunk, scene).pipe(Effect.catchAllCause(() => Effect.void));
    yield* blockHighlight.invalidateCache();
}));
const placeSelectedItemInFront = (camera, hotbarService, blockService, blockHighlight) => Effect.runPromise(Effect.gen(function* () {
    const selectedItem = yield* hotbarService.getSelectedBlockType();
    const selectedSlot = yield* hotbarService.getSelectedSlot();
    yield* Option.match(selectedItem, {
        onNone: () => Effect.void,
        onSome: (item) => {
            if (!Schema.is(BlockTypeSchema)(item))
                return Effect.void;
            return blockService.placeBlock(projectBlockAhead(camera, 4), item, SlotIndex.make(HOTBAR_START + SlotIndex.toNumber(selectedSlot))).pipe(Effect.catchAllCause(() => Effect.void));
        },
    });
    yield* blockHighlight.invalidateCache();
}));
const clearBlocksInFront = (camera, blockService, blockHighlight) => Effect.runPromise(Effect.gen(function* () {
    yield* Effect.forEach([3, 4], (distance) => {
        const pos = projectBlockAhead(camera, distance);
        return blockService.breakBlock(pos).pipe(Effect.catchAllCause(() => Effect.void));
    }, { concurrency: 1, discard: true });
    yield* blockHighlight.invalidateCache();
}));
// ---------------------------------------------------------------------------
// Combat operations
// ---------------------------------------------------------------------------
const spawnLowHealthZombieInFront = (camera, entityManager, stagedZombiePositionRef) => Effect.runPromise(Effect.gen(function* () {
    const direction = getNormalizedLookDirection(camera);
    const zombiePos = {
        x: camera.position.x + direction.x * 6,
        y: camera.position.y,
        z: camera.position.z + direction.z * 6,
    };
    MutableRef.set(stagedZombiePositionRef, zombiePos);
    const zombieId = yield* entityManager.addEntity(EntityType.Zombie, zombiePos);
    yield* entityManager.applyDamage(zombieId, 12);
}));
const attackFirstZombie = (hotbarService, entityManager) => Effect.runPromise(Effect.gen(function* () {
    const entities = yield* entityManager.getEntities();
    const zombieOpt = Arr.findFirst(entities, (entity) => entity.type === 'Zombie');
    return yield* Option.match(zombieOpt, {
        onNone: () => Effect.succeed(false),
        onSome: (zombie) => Effect.gen(function* () {
            const selectedItem = yield* hotbarService.getSelectedBlockType();
            const damage = Option.match(selectedItem, {
                onNone: () => PLAYER_ATTACK_DAMAGE,
                onSome: (item) => item === 'WOODEN_SWORD' ? WOODEN_SWORD_ATTACK_DAMAGE : PLAYER_ATTACK_DAMAGE,
            });
            yield* entityManager.applyDamage(zombie.entityId, damage);
            return true;
        }),
    });
}));
// ---------------------------------------------------------------------------
// Visual / aim / debug operations
// ---------------------------------------------------------------------------
const makeSetAimForQA = (camera, scene, playerCameraState, blockHighlight) => (target) => Effect.gen(function* () {
    const dx = target.x - camera.position.x;
    const dy = target.y - camera.position.y;
    const dz = target.z - camera.position.z;
    const yaw = Math.atan2(dx, -dz);
    const pitch = Math.atan2(dy, Math.hypot(dx, dz));
    yield* playerCameraState.setYaw(yaw);
    yield* playerCameraState.setPitch(pitch);
    yield* Effect.sync(() => {
        camera.rotation.set(pitch, yaw, 0, 'YXZ');
        camera.updateMatrixWorld(true);
        scene.updateMatrixWorld(true);
    });
}).pipe(Effect.zipRight(blockHighlight.invalidateCache()), Effect.zipRight(blockHighlight.update(camera, scene)));
const aimAtStagedResource = (camera, scene, playerCameraState, blockHighlight, stagedResourceBlocksRef, resourceIndex) => Effect.runPromise(Effect.gen(function* () {
    const target = MutableRef.get(stagedResourceBlocksRef)[resourceIndex];
    if (!target)
        return;
    const setAimForQA = makeSetAimForQA(camera, scene, playerCameraState, blockHighlight);
    yield* setAimForQA({ x: target.pos.x + 0.5, y: target.pos.y + 0.5, z: target.pos.z + 0.5 });
    yield* blockHighlight.setTargetForQA({ x: target.pos.x, y: target.pos.y, z: target.pos.z }, {
        point: { x: target.pos.x + 0.5, y: target.pos.y + 0.5, z: target.pos.z + 0.5 },
        normal: { x: 0, y: 0, z: 1 },
        distance: 4,
        blockX: target.pos.x,
        blockY: target.pos.y,
        blockZ: target.pos.z,
    });
}));
const aimAtBuildSpot = (camera, scene, playerCameraState, blockHighlight) => Effect.runPromise(Effect.gen(function* () {
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    direction.normalize();
    const wx = Math.floor(camera.position.x + direction.x * 4);
    const wy = Math.floor(camera.position.y);
    const wz = Math.floor(camera.position.z + direction.z * 4);
    const setAimForQA = makeSetAimForQA(camera, scene, playerCameraState, blockHighlight);
    yield* setAimForQA({ x: wx + 0.5, y: wy + 0.5, z: wz + 0.5 });
    yield* blockHighlight.setTargetForQA({ x: wx, y: wy, z: wz }, {
        point: { x: wx + 0.5, y: wy + 0.5, z: wz + 0.5 },
        normal: { x: 0, y: 1, z: 0 },
        distance: 4,
        blockX: wx,
        blockY: wy,
        blockZ: wz,
    });
}));
const aimAtStagedZombie = (camera, scene, playerCameraState, blockHighlight, stagedZombiePositionRef) => Effect.runPromise(Effect.gen(function* () {
    const stagedZombiePosition = MutableRef.get(stagedZombiePositionRef);
    if (!stagedZombiePosition)
        return;
    const setAimForQA = makeSetAimForQA(camera, scene, playerCameraState, blockHighlight);
    yield* setAimForQA({ x: stagedZombiePosition.x, y: stagedZombiePosition.y + 0.9, z: stagedZombiePosition.z });
    yield* blockHighlight.clearTargetForQA();
}));
const dispatchMouseClick = (button) => Effect.runPromise(Effect.sync(() => {
    document.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button }));
    document.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, button }));
    if (button === 2) {
        document.dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, button }));
    }
}));
const getRenderingSnapshot = (camera, scene) => {
    const chunkMeshes = getChunkMeshSnapshots(scene);
    return {
        sceneChildren: scene.children.length,
        chunkMeshCount: chunkMeshes.length,
        visibleChunkMeshCount: chunkMeshes.filter((mesh) => mesh.visible).length,
        camera: {
            x: camera.position.x,
            y: camera.position.y,
            z: camera.position.z,
            near: camera.near,
            far: camera.far,
        },
        chunks: chunkMeshes,
    };
};
const getLoadedWaterBlockCount = (chunkManagerService) => Effect.runPromise(Effect.gen(function* () {
    const chunks = yield* chunkManagerService.getLoadedChunks();
    const waterBlockIndex = blockTypeToIndex('WATER');
    let count = 0;
    for (const chunk of chunks) {
        for (const block of chunk.blocks) {
            if (block === waterBlockIndex)
                count += 1;
        }
    }
    return count;
}));
const getMobMovementSnapshot = (entityManager, durationMs) => Effect.runPromise(Effect.gen(function* () {
    const clampedDurationMs = Math.max(100, Math.floor(durationMs));
    const before = yield* entityManager.getEntities();
    const beforeById = new Map(before.map((entity) => [entity.entityId, entity.position]));
    yield* Effect.sleep(clampedDurationMs);
    const after = yield* entityManager.getEntities();
    let tracked = 0;
    let moved = 0;
    let maxDistance = 0;
    let maxHorizontalDistance = 0;
    let maxVerticalDistance = 0;
    for (const entity of after) {
        const previous = beforeById.get(entity.entityId);
        if (!previous)
            continue;
        tracked += 1;
        const dx = entity.position.x - previous.x;
        const dy = entity.position.y - previous.y;
        const dz = entity.position.z - previous.z;
        const horizontalDistance = Math.hypot(dx, dz);
        const distance = Math.hypot(dx, dy, dz);
        const verticalDistance = Math.abs(dy);
        if (horizontalDistance > 0.05)
            moved += 1;
        if (distance > maxDistance)
            maxDistance = distance;
        if (horizontalDistance > maxHorizontalDistance)
            maxHorizontalDistance = horizontalDistance;
        if (verticalDistance > maxVerticalDistance)
            maxVerticalDistance = verticalDistance;
    }
    return { tracked, moved, maxDistance, maxHorizontalDistance, maxVerticalDistance };
}));
const setTimeOfDayForQA = (timeService, timeOfDay) => Effect.runPromise(timeService.setTimeOfDay(timeOfDay));
// ---------------------------------------------------------------------------
// installQaApi — wires everything together and sets window.__TS_MINECRAFT_QA__
// ---------------------------------------------------------------------------
export const installQaApi = ({ camera, scene, playerCameraState, blockHighlight, inputService, inventoryService, inventoryRenderer, gameState, timeService, chunkManagerService, blockService, hotbarService, recipeService, furnaceService, worldRendererService, entityManager, debugFeatureFlags, }) => Effect.sync(() => {
    // Only expose QA API in development builds.
    // Uses the same two-signal check as terrain-worker-pool.ts: Vite's
    // import.meta.env.DEV (false in production builds) and the Node.js
    // NODE_ENV fallback for test environments.
    const qaApiEnv = getUnknownProperty(import.meta, 'env');
    const qaApiProcess = getUnknownProperty(globalThis, 'process');
    const isViteDev = isEnvLike(qaApiEnv) && qaApiEnv.DEV === true;
    const isNodeDev = isProcessLike(qaApiProcess) && qaApiProcess.env?.NODE_ENV === 'development';
    const isDevBuild = isViteDev || isNodeDev;
    if (!isDevBuild)
        return;
    if (typeof window === 'undefined') {
        return;
    }
    const stagedResourceBlocksRef = MutableRef.make([]);
    const stagedZombiePositionRef = MutableRef.make(null);
    const qa = {
        getInventorySnapshot: () => getInventorySnapshot(inventoryService),
        openInventoryForQA: () => openInventoryForQA(inventoryRenderer),
        craftRecipeForQA: (recipeId) => craftRecipeForQA(inventoryService, inventoryRenderer, recipeService, furnaceService, gameState, chunkManagerService, recipeId),
        stageProgressionScenario: () => stageProgressionScenario(camera, scene, chunkManagerService, worldRendererService, blockHighlight, stagedResourceBlocksRef, stagedZombiePositionRef),
        collectStagedResources: () => collectStagedResources(blockService, stagedResourceBlocksRef),
        spawnLowHealthZombieInFront: () => spawnLowHealthZombieInFront(camera, entityManager, stagedZombiePositionRef),
        aimAtStagedResource: (resourceIndex) => aimAtStagedResource(camera, scene, playerCameraState, blockHighlight, stagedResourceBlocksRef, resourceIndex),
        aimAtBuildSpot: () => aimAtBuildSpot(camera, scene, playerCameraState, blockHighlight),
        aimAtStagedZombie: () => aimAtStagedZombie(camera, scene, playerCameraState, blockHighlight, stagedZombiePositionRef),
        clearBlocksInFront: () => clearBlocksInFront(camera, blockService, blockHighlight),
        stageBuildSupportBlock: () => stageBuildSupportBlock(camera, scene, chunkManagerService, worldRendererService, blockHighlight),
        dispatchMouseClick: (button) => dispatchMouseClick(button),
        consumeMouseClickForQA: (button) => Effect.runPromise(inputService.consumeMouseClick(button)),
        getCurrentTargetForQA: () => Effect.runPromise(blockHighlight.getTargetBlock()),
        attackFirstZombie: () => attackFirstZombie(hotbarService, entityManager),
        placeSelectedItemInFront: () => placeSelectedItemInFront(camera, hotbarService, blockService, blockHighlight),
        moveItemToHotbar: (itemType, hotbarIndex) => moveItemToHotbar(inventoryService, hotbarService, itemType, hotbarIndex),
        selectHotbarSlot: (hotbarIndex) => selectHotbarSlot(hotbarService, hotbarIndex),
        getRecipeButtons: () => getRecipeButtons(recipeService),
        getEntitySnapshot: () => Effect.runPromise(entityManager.getEntities()),
        getLoadedWaterBlockCount: () => getLoadedWaterBlockCount(chunkManagerService),
        getMobMovementSnapshot: (durationMs) => getMobMovementSnapshot(entityManager, durationMs),
        setTimeOfDayForQA: (timeOfDay) => setTimeOfDayForQA(timeService, timeOfDay),
        getRenderingSnapshot: () => getRenderingSnapshot(camera, scene),
        getDebugFeatureSnapshot: () => Effect.runPromise(debugFeatureFlags.getSnapshot()),
        setDebugFeatureEnabled: (id, enabled) => Effect.runPromise(debugFeatureFlags.setEnabled(id, enabled)),
        resetDebugFeatures: (group) => Effect.runPromise(group === undefined ? debugFeatureFlags.resetAll() : debugFeatureFlags.resetGroup(group)),
    };
    Reflect.set(window, '__TS_MINECRAFT_QA__', qa);
});
//# sourceMappingURL=../../../../dist/packages/app/application/main/qa-api.js.map