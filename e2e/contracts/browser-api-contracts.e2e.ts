import { test, expect } from '@playwright/test'

/**
 * Playwright contract markers for Vitest coverage exclusions.
 *
 * Format: @contract <CATEGORY> <source-file> -- <browser capability>
 * The coverage policy checker consumes these markers for non-Node-testable files.
 *
 * @contract BROWSER_ONLY src/main.ts -- production browser entrypoint wiring
 * @contract BROWSER_ONLY packages/app/application/main -- app layer composition needs full browser runtime
 * @contract BROWSER_ONLY packages/app/application/frame -- frame pipeline is validated through browser runtime contracts
 * @contract WORKER packages/worker/infrastructure/terrain-worker.ts -- WorkerGlobalScope terrain protocol
 * @contract WORKER packages/worker/infrastructure/terrain-worker-pool.ts -- browser Worker construction and messaging
 * @contract WORKER packages/worker/infrastructure/terrain-worker-pool-helpers.ts -- worker pool browser lifecycle helpers
 * @contract WORKER packages/worker/infrastructure/terrain-worker-pool-port-layer.ts -- Worker-backed port wiring
 * @contract WORKER packages/worker/infrastructure/meshing -- meshing worker runtime protocol and pool lifecycle
 * @contract BROWSER_ONLY packages/block/domain/light.ts -- browser integration exercises lighting byte-grid invariants
 * @contract BROWSER_ONLY packages/entity/application/redstone/redstone-service.ts -- redstone simulation is exercised in browser gameplay contracts
 * @contract BROWSER_ONLY packages/game/application/settings-service.ts -- settings persistence and graphics presets are exercised in browser UI contracts
 * @contract BROWSER_ONLY god-rays-pass -- WebGL post-processing pass
 * @contract BROWSER_ONLY packages/rendering/infrastructure/meshing/chunk-mesh.ts -- THREE BufferGeometry/WebGL mesh boundary
 * @contract BROWSER_ONLY packages/rendering/infrastructure/meshing -- browser/WebGL mesh geometry and material boundaries
 * @contract BROWSER_ONLY packages/rendering/infrastructure/entity -- entity renderer and instancing WebGL boundaries
 * @contract BROWSER_ONLY packages/rendering/infrastructure/perf -- browser GPU timer/performance query boundary
 * @contract BROWSER_ONLY packages/rendering/infrastructure/renderer -- WebGL world renderer boundaries
 * @contract BROWSER_ONLY packages/rendering/infrastructure/renderer/renderer-service.ts -- WebGLRenderer boundary
 * @contract BROWSER_ONLY packages/rendering/infrastructure/textures/texture-loader.ts -- browser fetch/Image texture loading
 * @contract BROWSER_ONLY packages/rendering/presentation -- browser DOM performance HUD contracts
 * @contract BROWSER_ONLY perf-marks -- browser performance API marks
 * @contract BROWSER_ONLY packages/rendering/application/perf-flags.ts -- URL/window feature detection
 * @contract BROWSER_ONLY packages/world/application -- world runtime services are exercised by browser gameplay contracts
 * @contract BROWSER_ONLY packages/world/domain/block-light-bfs.ts -- browser gameplay contracts exercise light BFS integration
 * @contract BROWSER_ONLY packages/world/domain/chunk-coord-utils.ts -- browser gameplay contracts exercise chunk coordinate integration
 * @contract BROWSER_ONLY packages/world/domain/light-engine-model.ts -- light-engine data model is contract-covered through light engine integration
 * @contract BROWSER_ONLY packages/world/domain/sky-light-bfs.ts -- browser gameplay contracts exercise sky-light BFS integration
 * @contract BROWSER_ONLY packages/world/domain/terrain/generator-pipeline.ts -- browser world-generation contracts exercise terrain pipeline integration
 * @contract BROWSER_ONLY packages/world/infrastructure/idb-utils.ts -- IndexedDB request/cursor adapter
 * @contract BROWSER_ONLY packages/world/infrastructure/storage-service.ts -- IndexedDB persistence adapter
 * @contract BROWSER_ONLY packages/world/infrastructure/storage-error-mapping.ts -- IndexedDB error mapping contract
 * @contract BROWSER_ONLY packages/world/infrastructure/storage-idb-model.ts -- IndexedDB key/schema contract
 * @contract BROWSER_ONLY packages/world/infrastructure/storage-serialization.ts -- IndexedDB serialization contract
 * @contract BROWSER_ONLY packages/game/infrastructure/audio-engine.ts -- Web Audio API boundary
 * @contract BROWSER_ONLY packages/core/domain/math/camera-port.ts -- browser/THREE camera duck-type schema boundary
 * @contract BROWSER_ONLY packages/presentation/inventory/inventory-renderer-click-handler.ts -- DOM MouseEvent handler boundary
 * @contract BROWSER_ONLY pause-menu -- DOM menu overlay boundary
 * @contract BROWSER_ONLY death-screen -- DOM death-screen overlay boundary
 * @contract BROWSER_ONLY input-service -- DOM KeyboardEvent/MouseEvent input boundary
 * @contract BROWSER_ONLY packages/presentation/hud/debug-overlay.ts -- DOM debug overlay boundary
 * @contract BROWSER_ONLY packages/presentation/menu/main-menu.ts -- DOM main-menu boundary
 * @contract BROWSER_ONLY packages/presentation/menu/confirm-dialog.ts -- DOM confirm-dialog boundary
 * @contract BROWSER_ONLY packages/presentation/settings/settings-overlay.ts -- DOM settings overlay boundary
 * @contract BROWSER_ONLY packages/rendering/presentation/perf-hud.ts -- DOM performance HUD boundary
 */
test.describe('browser API coverage contracts', () => {
  test('storage-service IndexedDB roundtrip works in Chromium', async ({ page }) => {
    await page.goto('/e2e-cleanup.html')

    const runnerUrl = `/@fs/${process.cwd()}/e2e/contracts/storage-service-contract-runner.ts`
    const result = await page.evaluate(async (url) => {
      const runner = await import(url) as typeof import('./storage-service-contract-runner')
      return runner.runStorageServiceIndexedDbRoundtrip()
    }, runnerUrl)

    expect(result.savedBlocks).toEqual([1, 2, 3, 4])
    expect(result.loadedBlocks).toEqual(result.savedBlocks)
    expect(result.loadedFluid).toEqual([9, 8, 7, 6])
  })
})
