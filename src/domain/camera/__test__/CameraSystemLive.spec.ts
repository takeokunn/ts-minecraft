import { describe, it, expect } from '@effect/vitest'
import { Effect, Layer, Context } from 'effect'
import { CameraSystemLive } from '../CameraSystemLive'
import { CameraService } from '../CameraService'

describe('CameraSystemLive', () => {
  describe('Layer構成', () => {
    it.effect('CameraSystemLiveがLayerとして正しく定義される', () =>
      Effect.gen(function* () {
        // LayerがEffect-TSのLayerであることを確認
        expect(CameraSystemLive).toBeDefined()
        expect(typeof CameraSystemLive).toBe('object')

        // Layerの基本的な構造を持つことを確認
        expect('pipe' in CameraSystemLive).toBe(true)
      })
    )

    it.effect('CameraServiceを提供できる', () =>
      Effect.gen(function* () {
        // CameraSystemLiveを使ってCameraServiceが取得できることを確認
        const cameraService = yield* Effect.gen(function* () {
          return yield* CameraService
        }).pipe(Effect.provide(CameraSystemLive))

        expect(cameraService).toBeDefined()
        expect(typeof cameraService).toBe('object')

        // CameraServiceのインターフェースメソッドが存在することを確認
        expect(typeof cameraService.initialize).toBe('function')
        expect(typeof cameraService.switchMode).toBe('function')
        expect(typeof cameraService.update).toBe('function')
        expect(typeof cameraService.rotate).toBe('function')
        expect(typeof cameraService.setFOV).toBe('function')
        expect(typeof cameraService.setSensitivity).toBe('function')
        expect(typeof cameraService.setThirdPersonDistance).toBe('function')
        expect(typeof cameraService.setSmoothing).toBe('function')
        expect(typeof cameraService.getState).toBe('function')
        expect(typeof cameraService.getConfig).toBe('function')
        expect(typeof cameraService.getCamera).toBe('function')
        expect(typeof cameraService.reset).toBe('function')
        expect(typeof cameraService.updateAspectRatio).toBe('function')
        expect(typeof cameraService.dispose).toBe('function')
      })
    )

    it.effect('Layer統合が正しく動作する', () =>
      Effect.gen(function* () {
        // CameraSystemLiveがFirstPersonCameraLiveとThirdPersonCameraLiveを統合していることを確認
        // 実際のサービス提供が動作するかテスト
        const service = yield* Effect.gen(function* () {
          const cameraService = yield* CameraService
          return cameraService
        }).pipe(Effect.provide(CameraSystemLive))

        // サービスが正常に取得できることを確認
        expect(service).toBeDefined()

        // 基本的なメソッドが呼び出し可能であることを確認
        expect(() => service.getState()).not.toThrow()
        expect(() => service.getConfig()).not.toThrow()
        expect(() => service.getCamera()).not.toThrow()
      })
    )
  })

  describe('サービス統合', () => {
    it.effect('複数のCameraServiceインスタンスを作成できる', () =>
      Effect.gen(function* () {
        // 複数回CameraServiceを取得しても問題ないことを確認
        const service1 = yield* Effect.gen(function* () {
          return yield* CameraService
        }).pipe(Effect.provide(CameraSystemLive))

        const service2 = yield* Effect.gen(function* () {
          return yield* CameraService
        }).pipe(Effect.provide(CameraSystemLive))

        expect(service1).toBeDefined()
        expect(service2).toBeDefined()

        // 同じインターフェースを持つことを確認
        expect(typeof service1.initialize).toBe(typeof service2.initialize)
        expect(typeof service1.getState).toBe(typeof service2.getState)
      })
    )

    it.effect('Layer合成の一貫性', () =>
      Effect.gen(function* () {
        // Layer.mergeAllの結果が一貫していることを確認
        const cameraService = yield* CameraService.pipe(Effect.provide(CameraSystemLive))

        // getStateとgetConfigが正常に動作することを確認
        const initialState = yield* cameraService.getState()
        const initialConfig = yield* cameraService.getConfig()

        expect(initialState).toBeDefined()
        expect(initialConfig).toBeDefined()

        // 状態の基本構造を確認
        expect(typeof initialState.position).toBe('object')
        expect(typeof initialState.rotation).toBe('object')
        expect(typeof initialState.target).toBe('object')

        // 設定の基本構造を確認
        expect(typeof initialConfig.fov).toBe('number')
        expect(typeof initialConfig.sensitivity).toBe('number')
        expect(typeof initialConfig.mode).toBe('string')
      })
    )
  })

  describe('型安全性', () => {
    it.effect('CameraServiceタグが正しく解決される', () =>
      Effect.gen(function* () {
        // Context.GenericTagが正しく動作することを確認
        const tag = CameraService
        expect(tag).toBeDefined()

        // Layerを通してサービスが解決できることを確認
        const service = yield* tag.pipe(Effect.provide(CameraSystemLive))
        expect(service).toBeDefined()
      })
    )

    it.effect('Effect合成の型安全性', () =>
      Effect.gen(function* () {
        // Effect合成が型安全に動作することを確認
        const result = yield* Effect.gen(function* () {
          const service = yield* CameraService
          const state = yield* service.getState()
          const config = yield* service.getConfig()
          return { state, config }
        }).pipe(Effect.provide(CameraSystemLive))

        expect(result.state).toBeDefined()
        expect(result.config).toBeDefined()

        // 戻り値の型構造を確認
        expect('position' in result.state).toBe(true)
        expect('rotation' in result.state).toBe(true)
        expect('target' in result.state).toBe(true)

        expect('fov' in result.config).toBe(true)
        expect('sensitivity' in result.config).toBe(true)
        expect('mode' in result.config).toBe(true)
      })
    )
  })

  describe('エラーハンドリング', () => {
    it.effect('Layerの依存関係解決エラーハンドリング', () =>
      Effect.gen(function* () {
        // 正常なLayer提供での動作確認
        const effect = Effect.gen(function* () {
          const service = yield* CameraService
          return service
        }).pipe(Effect.provide(CameraSystemLive))

        const service = yield* effect
        expect(service).toBeDefined()
      })
    )

    it.effect('サービスメソッドのエラーハンドリング', () =>
      Effect.gen(function* () {
        const service = yield* CameraService.pipe(Effect.provide(CameraSystemLive))

        // メソッド呼び出しが適切にEffect型を返すことを確認
        const stateEffect = service.getState()
        const configEffect = service.getConfig()
        const cameraEffect = service.getCamera()

        expect(stateEffect).toBeDefined()
        expect(configEffect).toBeDefined()
        expect(cameraEffect).toBeDefined()

        // 実際にEffectを実行
        const state = yield* stateEffect
        const config = yield* configEffect
        const camera = yield* cameraEffect

        expect(state).toBeDefined()
        expect(config).toBeDefined()
        // cameraは初期化前なのでnullの可能性がある
        expect(camera === null || typeof camera === 'object').toBe(true)
      })
    )
  })

  describe('リソース管理', () => {
    it.effect('Layerライフサイクル管理', () =>
      Effect.gen(function* () {
        // CameraSystemLiveが適切にリソースを管理することを確認
        const service = yield* CameraService.pipe(Effect.provide(CameraSystemLive))

        // disposeメソッドが利用可能であることを確認
        expect(typeof service.dispose).toBe('function')

        // 実際にdisposeを呼び出してもエラーが発生しないことを確認
        yield* service.dispose()

        // dispose後も基本的な操作が可能であることを確認
        const state = yield* service.getState()
        expect(state).toBeDefined()
      })
    )

    it.effect('スコープ付きリソース管理', () =>
      Effect.gen(function* () {
        // Effect.scopedでリソースが適切に管理されることを確認
        const result = yield* Effect.scoped(
          Effect.gen(function* () {
            const service = yield* CameraService.pipe(Effect.provide(CameraSystemLive))
            const config = yield* service.getConfig()
            return config
          })
        )

        expect(result).toBeDefined()
        expect(typeof result.fov).toBe('number')
      })
    )
  })

  describe('パフォーマンス', () => {
    it.effect('Layer初期化のパフォーマンス', () =>
      Effect.gen(function* () {
        const startTime = Date.now()

        const service = yield* CameraService.pipe(Effect.provide(CameraSystemLive))
        const config = yield* service.getConfig()

        const endTime = Date.now()
        const duration = endTime - startTime

        // Layer初期化が合理的な時間内に完了することを確認
        expect(duration).toBeLessThan(1000) // 1秒以内
        expect(config).toBeDefined()
      })
    )

    it.effect('複数サービスアクセスのパフォーマンス', () =>
      Effect.gen(function* () {
        const service = yield* CameraService.pipe(Effect.provide(CameraSystemLive))

        const startTime = Date.now()

        // 複数のメソッドを連続して呼び出し
        const state = yield* service.getState()
        const config = yield* service.getConfig()
        const camera = yield* service.getCamera()

        const endTime = Date.now()
        const duration = endTime - startTime

        // 複数メソッド呼び出しが効率的であることを確認
        expect(duration).toBeLessThan(100) // 100ms以内
        expect(state).toBeDefined()
        expect(config).toBeDefined()
        expect(camera === null || typeof camera === 'object').toBe(true)
      })
    )
  })
})
