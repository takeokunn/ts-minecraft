#!/usr/bin/env tsx

import { Option, pipe, ReadonlyArray } from 'effect'
import * as Match from 'effect/Match'
import { glob } from 'glob'
import * as fs from 'node:fs'

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
} as const

const PATH_ALIAS_ENTRIES = Object.entries(PATH_ALIASES) as ReadonlyArray<readonly [string, string]>
const ALLOWED_FOURTH_LEVEL_SEGMENTS = ['types', 'index', 'constants', 'errors', 'events'] as const
const ALLOWED_FOURTH_LEVEL = new Set<string>(ALLOWED_FOURTH_LEVEL_SEGMENTS)
const EMPTY_VIOLATIONS: ReadonlyArray<Violation> = []
const IMPORT_PATTERN = /import\s+.*\s+from\s+(['"])(.+?)\1/

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
const resolvePathAlias = (importPath: string): Option.Option<string> =>
  pipe(
    PATH_ALIAS_ENTRIES,
    ReadonlyArray.findFirst(([alias]) => importPath.startsWith(alias)),
    Option.map(([alias, realPath]) => importPath.replace(alias, realPath))
  )

/**
 * トップレベルディレクトリを取得（例: "src/domain/chunk" → "domain"）
 */
const getTopLevelDir = (filePath: string): Option.Option<string> =>
  pipe(
    filePath.match(/^src\/([^/]+)/),
    Option.fromNullable,
    Option.map((match) => match[1])
  )

/**
 * 第2レベルディレクトリまでを取得（例: "src/domain/chunk" → "domain/chunk"）
 */
const getModulePath = (filePath: string): Option.Option<string> =>
  pipe(
    filePath.match(/^src\/([^/]+\/[^/]+)/),
    Option.fromNullable,
    Option.map((match) => match[1])
  )

/**
 * importパスの第2レベルディレクトリまでを取得
 */
const getImportModulePath = (importPath: string): Option.Option<string> =>
  pipe(resolvePathAlias(importPath), Option.flatMap(getModulePath))

/**
 * importパスの階層構造からindex.ts経由かどうかを判定
 */
const evaluateImportDepth = (parts: ReadonlyArray<string>): boolean =>
  pipe(
    parts.length,
    Match.value,
    Match.when((length) => length <= 3, () => true),
    Match.when((length) => length === 4, () =>
      pipe(
        ReadonlyArray.last(parts),
        Option.map((segment) => ALLOWED_FOURTH_LEVEL.has(segment)),
        Option.getOrElse(() => false)
      )
    ),
    Match.when((length) => length >= 5, () => true),
    Match.orElse(() => false)
  )

/**
 * index.ts経由かどうかをチェック
 */
const isIndexImport = (importPath: string): boolean =>
  pipe(
    Match.value(importPath),
    Match.when((path) => !path.startsWith('@'), () => true),
    Match.orElse(() =>
      pipe(
        resolvePathAlias(importPath),
        Option.match({
          onNone: () => true,
          onSome: (resolved) => evaluateImportDepth(resolved.split('/')),
        })
      )
    )
  )

// =============================================================================
// Validation Rules
// =============================================================================

/**
 * FR-4: .js/.ts拡張子の検出（.jsonは除外）
 */
const checkExtension = (importPath: string): boolean =>
  /\.(ts|js)['"]$/.test(importPath) && !/\.json['"]$/.test(importPath)

/**
 * FR-2: 同一モジュール（第2レベル）内でのpath alias使用（テストファイルは除外）
 * 例: src/domain/chunk_manager 内から @domain/chunk_manager へのimportは禁止
 * 　　src/domain/chunk_manager から @domain/chunk へのimportは許可（異なるモジュール）
 */
const checkSameLayerAlias = (filePath: string, importPath: string): boolean =>
  pipe(
    Match.value(filePath),
    Match.when(isTestFile, () => false),
    Match.orElse(() =>
      pipe(
        Match.value(importPath),
        Match.when((path) => !path.startsWith('@'), () => false),
        Match.orElse(() =>
          pipe(
            Option.Do,
            Option.bind('fileModulePath', () => getModulePath(filePath)),
            Option.bind('importModulePath', () => getImportModulePath(importPath)),
            Option.map(({ fileModulePath, importModulePath }) => fileModulePath === importModulePath),
            Option.getOrElse(() => false)
          )
        )
      )
    )
  )

/**
 * FR-1, FR-2: index.ts経由の強制（テストファイルは除外）
 */
const checkIndexImport = (filePath: string, importPath: string): boolean =>
  pipe(
    Match.value(filePath),
    Match.when(isTestFile, () => false),
    Match.orElse(() =>
      pipe(
        Match.value(importPath),
        Match.when((path) => !path.startsWith('@'), () => false),
        Match.orElse(() => isIndexImport(importPath))
      )
    )
  )

// =============================================================================
// Helpers for Violation Detection
// =============================================================================

const parseImportPath = (line: string): Option.Option<string> =>
  pipe(IMPORT_PATTERN.exec(line), Option.fromNullable, Option.map((match) => match[2]))

const violationWhen = (condition: boolean, violation: () => Violation): Option.Option<Violation> =>
  pipe(Option.some(condition), Option.filter(Boolean), Option.map(violation))

const lineViolations = (filePath: string, line: string, lineNumber: number): ReadonlyArray<Violation> =>
  pipe(
    parseImportPath(line),
    Option.map((importPath) => {
      const createViolation = (message: string): Violation => ({
        file: filePath,
        line: lineNumber,
        message,
        importStatement: line.trim(),
      })

      return pipe(
        [
          violationWhen(checkExtension(importPath), () =>
            createViolation('Remove .js/.ts extension from imports')
          ),
          violationWhen(checkSameLayerAlias(filePath, importPath), () =>
            createViolation('Use relative path instead of path alias within same layer')
          ),
          violationWhen(checkIndexImport(filePath, importPath), () =>
            createViolation('Import from index.ts instead of internal file')
          ),
        ],
        ReadonlyArray.compact
      )
    }),
    Option.getOrElse(() => EMPTY_VIOLATIONS)
  )

/**
 * ファイル内のimport文を検証
 */
const validateFile = (filePath: string): ReadonlyArray<Violation> =>
  pipe(
    fs.readFileSync(filePath, 'utf-8').split('\n'),
    ReadonlyArray.mapWithIndex((index, line) => lineViolations(filePath, line, index + 1)),
    ReadonlyArray.flatten
  )

/**
 * メイン処理
 */
async function main() {
  const files = await glob('src/**/*.{ts,tsx}', {
    ignore: ['node_modules/**', 'dist/**'],
  })

  const allViolations = pipe(files, ReadonlyArray.flatMap(validateFile))

  pipe(
    allViolations,
    Match.value,
    Match.when(ReadonlyArray.isEmpty, () => {
      console.log('✅ All imports are valid')
      process.exit(0)
    }),
    Match.orElse((violations) => {
      console.log(`❌ Found ${violations.length} import violations:\n`)

      pipe(
        violations,
        ReadonlyArray.groupBy((violation) => violation.file),
        (grouped) => Array.from(grouped.entries()),
        ReadonlyArray.forEach(([file, fileViolations]) =>
          pipe(
            fileViolations,
            ReadonlyArray.forEach((violation) => {
              console.log(`${file}:${violation.line}`)
              console.log(`  ${violation.message}`)
              console.log(`  ${violation.importStatement}\n`)
            })
          )
        )
      )

      process.exit(1)
    })
  )
}

main().catch((error) => {
  console.error('Error running validation:', error)
  process.exit(1)
})
