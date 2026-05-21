import { describe, expect, it, beforeAll, afterAll, vi } from 'vitest'
import { Effect } from 'effect'
import * as THREE from 'three'

// Direct assertion that the atlas texture wired into ChunkMeshService applies
// the mipmap + anisotropy settings documented in chunk-mesh.ts:115-130:
//
//   texture.generateMipmaps = true
//   texture.minFilter = THREE.NearestMipmapNearestFilter
//   texture.anisotropy = 8
//
// The five existing world-renderer tests use injected `ChunkMeshService` mocks
// (see world-renderer-test-utils.ts:82-89) — they never exercise the real
// `buildAtlasTexture` path, so a regression that flipped `generateMipmaps`
// off or dropped the anisotropy assignment would not be caught.
//
// We can't import `buildAtlasTexture` (it is module-private). Instead we mock
// `document.createElement('canvas')` and `globalThis.Image` so `ChunkMeshService.Default`
// can build, then assert on `service.atlasTexture` which is exposed by the
// service contract.

let originalDocument: typeof globalThis.document | undefined
let originalImage: typeof globalThis.Image | undefined

beforeAll(() => {
  originalDocument = globalThis.document
  originalImage = globalThis.Image

  const ctx2d = {
    fillStyle: '#ffffff',
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  }

  Object.defineProperty(globalThis, 'document', {
    configurable: true,
    writable: true,
    value: {
      createElement: vi.fn((_tag: string) => ({
        width: 256,
        height: 256,
        getContext: () => ctx2d,
      })),
      body: { appendChild: vi.fn() },
    },
  })

  class MockImage {
    onload: (() => void) | null = null
    onerror: ((_e: unknown) => void) | null = null
    private _src = ''
    get src(): string {
      return this._src
    }
    set src(url: string) {
      this._src = url
      // Synchronously fire onload to simulate atlas decode success.
      if (this.onload) this.onload()
    }
  }

  Object.defineProperty(globalThis, 'Image', {
    configurable: true,
    writable: true,
    value: MockImage as unknown as typeof Image,
  })
})

afterAll(() => {
  if (originalDocument === undefined) {
    Reflect.deleteProperty(globalThis, 'document')
  } else {
    Object.defineProperty(globalThis, 'document', {
      configurable: true,
      writable: true,
      value: originalDocument,
    })
  }
  if (originalImage === undefined) {
    Reflect.deleteProperty(globalThis, 'Image')
  } else {
    Object.defineProperty(globalThis, 'Image', {
      configurable: true,
      writable: true,
      value: originalImage,
    })
  }
})

// Import AFTER the globals are stubbed so ChunkMeshService.Default sees the mocks.
// Using a top-level dynamic import keeps this self-contained to the file.
const importChunkMeshService = async () => {
  const mod = await import('@ts-minecraft/rendering')
  return mod.ChunkMeshService
}

describe('chunk-mesh atlas texture wiring', () => {
  it('atlasTexture has generateMipmaps=true, minFilter=NearestMipmapNearestFilter, anisotropy=8', async () => {
    const ChunkMeshService = await importChunkMeshService()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ChunkMeshService
          const tex = service.atlasTexture

          expect(tex).toBeDefined()
          expect(tex.generateMipmaps).toBe(true)
          expect(tex.minFilter).toBe(THREE.NearestMipmapNearestFilter)
          expect(tex.anisotropy).toBe(8)
        }).pipe(Effect.provide(ChunkMeshService.Default)),
      ),
    )
  })

  it('atlasTexture keeps magFilter=NearestFilter and clamp-to-edge wrap modes', async () => {
    const ChunkMeshService = await importChunkMeshService()
    await Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* () {
          const service = yield* ChunkMeshService
          const tex = service.atlasTexture

          // Voxel-pixelated look at close range — companion invariants to the
          // mipmap settings; if magFilter accidentally flipped to LinearFilter
          // the blocky aesthetic would silently regress.
          expect(tex.magFilter).toBe(THREE.NearestFilter)
          expect(tex.wrapS).toBe(THREE.ClampToEdgeWrapping)
          expect(tex.wrapT).toBe(THREE.ClampToEdgeWrapping)
        }).pipe(Effect.provide(ChunkMeshService.Default)),
      ),
    )
  })
})

