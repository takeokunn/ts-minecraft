import type { AnyGameError } from './GameErrors'
import type { AnyNetworkError } from './NetworkErrors'
import type { AnyAppError } from '../../core/errors/AppError'

// 全エラータイプのユニオン型
export type AllErrors = AnyGameError | AnyNetworkError | AnyAppError
