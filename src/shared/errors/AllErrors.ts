import type { AnyGameError } from './GameErrors'
import type { AnyNetworkError } from './NetworkErrors'

// 全エラータイプのユニオン型
export type AllErrors = AnyGameError | AnyNetworkError