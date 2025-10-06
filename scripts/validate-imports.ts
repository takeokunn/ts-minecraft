#!/usr/bin/env tsx

import { glob } from 'glob'
import * as fs from 'node:fs'
import * as path from 'node:path'

// =============================================================================
// Types
// =============================================================================

type Violation = {
  file: string
  line: number
  message: string
  importStatement: string
}

// =============================================================================
// Path Alias Mapping
// =============================================================================

const PATH_ALIASES = {
  '@config': 'src/config',
  '@domain': 'src/domain',
  '@application': 'src/application',
  '@infrastructure': 'src/infrastructure',
  '@presentation': 'src/presentation',
  '@shared': 'src/shared',
  '@bootstrap': 'src/bootstrap',
}

// =============================================================================
// Utility Functions
// =============================================================================

/**
 * テストファイルかどうかを判定
 */
function isTestFile(filePath: string): boolean {
  return /\.(spec|test)\.tsx?$/.test(filePath) || filePath.includes('/__tests__/')
}

/**
 * path aliasを実際のパスに解決
 */
function resolvePathAlias(importPath: string): string | null {
  for (const [alias, realPath] of Object.entries(PATH_ALIASES)) {
    if (importPath.startsWith(alias)) {
      return importPath.replace(alias, realPath)
    }
  }
  return null
}

/**
 * トップレベルディレクトリを取得（例: "src/domain/chunk" → "domain"）
 */
function getTopLevelDir(filePath: string): string | null {
  const match = filePath.match(/^src\/([^/]+)/)
  return match?.[1] ?? null
}

/**
 * 第2レベルディレクトリまでを取得（例: "src/domain/chunk" → "domain/chunk"）
 */
function getModulePath(filePath: string): string | null {
  const match = filePath.match(/^src\/([^/]+\/[^/]+)/)
  return match?.[1] ?? null
}

/**
 * importパスの第2レベルディレクトリまでを取得
 */
function getImportModulePath(importPath: string): string | null {
  const resolved = resolvePathAlias(importPath)
  if (!resolved) return null
  return getModulePath(resolved)
}

/**
 * importパスのトップレベルディレクトリを取得
 */
function getImportTopLevelDir(importPath: string): string | null {
  const resolved = resolvePathAlias(importPath)
  if (!resolved) return null
  return getTopLevelDir(resolved)
}

/**
 * index.ts経由かどうかをチェック
 *
 * OK: '@domain/inventory' (第2レベルまで、index.ts経由)
 * NG: '@domain/inventory/inventory-service' (第3レベル、内部ファイル直接参照)
 * OK: '@domain/inventory/value_object/stack_size/operations' (深い構造、明示的なファイル)
 *
 * ルール:
 * - 第2レベルまで（src/xxx/yyy）: index.ts経由とみなす → OK
 * - 第3レベル（src/xxx/yyy/zzz）: 内部ファイル直接参照の可能性 → 要チェック
 * - 第4レベル以降（src/xxx/yyy/zzz/...）: 深い構造の明示的ファイル → OK
 */
function isIndexImport(importPath: string): boolean {
  // path aliasの場合のみチェック
  if (!importPath.startsWith('@')) return true

  const resolved = resolvePathAlias(importPath)
  if (!resolved) return true // 解決できない場合はスキップ

  // パスを分割
  const parts = resolved.split('/')

  // 第2レベルまで（例: src/domain/inventory）
  if (parts.length <= 3) {
    return true // index.ts経由とみなす
  }

  // 第4階層（例: src/domain/entities/types）
  // typesやindexなどのサブディレクトリは許可
  if (parts.length === 4) {
    const lastSegment = parts[parts.length - 1]
    // types, index, constants などの共通サブディレクトリは許可
    if (['types', 'index', 'constants', 'errors', 'events'].includes(lastSegment)) {
      return true
    }
  }

  // 第5レベル以降（例: src/domain/inventory/value_object/stack_size/operations）
  if (parts.length >= 5) {
    return true // 深い構造の明示的なファイルとして許可
  }

  // 第3-4レベル（例: src/domain/inventory/inventory-service）
  // → これが内部ファイル直接参照の可能性が高い
  return false
}

// =============================================================================
// Validation Rules
// =============================================================================

/**
 * FR-4: .js/.ts拡張子の検出（.jsonは除外）
 */
function checkExtension(importPath: string): boolean {
  return /\.(ts|js)['"]$/.test(importPath) && !/\.json['"]$/.test(importPath)
}

/**
 * FR-2: 同一モジュール（第2レベル）内でのpath alias使用（テストファイルは除外）
 * 例: src/domain/chunk_manager 内から @domain/chunk_manager へのimportは禁止
 * 　　src/domain/chunk_manager から @domain/chunk へのimportは許可（異なるモジュール）
 */
function checkSameLayerAlias(filePath: string, importPath: string): boolean {
  if (isTestFile(filePath)) return false
  if (!importPath.startsWith('@')) return false

  const fileModulePath = getModulePath(filePath)
  const importModulePath = getImportModulePath(importPath)

  return fileModulePath !== null && importModulePath !== null && fileModulePath === importModulePath
}

/**
 * FR-1, FR-2: index.ts経由の強制（テストファイルは除外）
 */
function checkIndexImport(filePath: string, importPath: string): boolean {
  if (isTestFile(filePath)) return false
  if (!importPath.startsWith('@')) return false

  return !isIndexImport(importPath)
}

// =============================================================================
// Main Validation
// =============================================================================

/**
 * ファイル内のimport文を検証
 */
function validateFile(filePath: string): Violation[] {
  const violations: Violation[] = []
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n')

  lines.forEach((line, index) => {
    // import文のパターンマッチ
    const importMatch = line.match(/import\s+.*\s+from\s+(['"])(.+?)\1/)
    if (!importMatch) return

    const importPath = importMatch[2]
    const lineNumber = index + 1

    // FR-4: .js/.ts拡張子チェック
    if (checkExtension(importPath)) {
      violations.push({
        file: filePath,
        line: lineNumber,
        message: 'Remove .js/.ts extension from imports',
        importStatement: line.trim(),
      })
    }

    // FR-2: 同一レイヤー内でのpath alias使用チェック
    if (checkSameLayerAlias(filePath, importPath)) {
      violations.push({
        file: filePath,
        line: lineNumber,
        message: 'Use relative path instead of path alias within same layer',
        importStatement: line.trim(),
      })
    }

    // FR-1, FR-2: index.ts経由チェック
    if (checkIndexImport(filePath, importPath)) {
      violations.push({
        file: filePath,
        line: lineNumber,
        message: 'Import from index.ts instead of internal file',
        importStatement: line.trim(),
      })
    }
  })

  return violations
}

/**
 * メイン処理
 */
async function main() {
  const files = await glob('src/**/*.{ts,tsx}', {
    ignore: ['node_modules/**', 'dist/**'],
  })

  const allViolations: Violation[] = []

  for (const file of files) {
    const violations = validateFile(file)
    allViolations.push(...violations)
  }

  if (allViolations.length === 0) {
    console.log('✅ All imports are valid')
    process.exit(0)
  }

  console.log(`❌ Found ${allViolations.length} import violations:\n`)

  // ファイル別にグループ化して出力
  const violationsByFile = new Map<string, Violation[]>()
  for (const violation of allViolations) {
    const existing = violationsByFile.get(violation.file) ?? []
    existing.push(violation)
    violationsByFile.set(violation.file, existing)
  }

  for (const [file, violations] of violationsByFile.entries()) {
    for (const violation of violations) {
      console.log(`${file}:${violation.line}`)
      console.log(`  ${violation.message}`)
      console.log(`  ${violation.importStatement}\n`)
    }
  }

  process.exit(1)
}

main().catch((error) => {
  console.error('Error running validation:', error)
  process.exit(1)
})
