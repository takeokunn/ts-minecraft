import { Clock, Context, Effect, Layer } from 'effect'

/**
 * WorldClock - ワールドドメイン向け時間サービス
 *
 * Effect-TSのClockサービスをベースに、現在時刻の数値および
 * Dateオブジェクト化を完全にEffectとして提供する。
 */
export interface WorldClock {
  readonly currentMillis: Effect.Effect<number>
  readonly currentDate: Effect.Effect<Date>
}

/**
 * WorldClockタグ。ワールドドメイン全体で共有する時間依存を解決する。
 */
export const WorldClock = Context.GenericTag<WorldClock>('@ts-minecraft/domain/world/WorldClock')

/**
 * 実運用向けのWorldClock実装。
 * - 現在時刻はEffect.Clockを利用して副作用を隔離
 * - Date生成もEffect内で行い、参照透明性を保つ
 */
export const WorldClockLive = Layer.effect(
  WorldClock,
  Effect.succeed<WorldClock>({
    currentMillis: Clock.currentTimeMillis,
    currentDate: Effect.map(Clock.currentTimeMillis, (now) => new Date(now))
  })
)

/**
 * テスト用のWorldClock。任意の時刻を差し込めるようファクトリで生成する。
 */
export const makeWorldClockTestLayer = (fixedMillis: number) =>
  Layer.succeed(WorldClock, {
    currentMillis: Effect.succeed(fixedMillis),
    currentDate: Effect.succeed(new Date(fixedMillis))
  } satisfies WorldClock)
