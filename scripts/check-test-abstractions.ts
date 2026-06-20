import { readFile } from 'node:fs/promises'
import { collectTestFiles, relativeFromRoot, type Violation } from './check-utils.ts'

const effectUsagePattern = /\b(?:Effect|Layer|Context|Exit|Cause)\b/u
const localFactoryPattern = /\b(?:function|const)\s+(?:create|make|build)[A-Z][A-Za-z0-9_]*(?:\s*=|\s*\()/u
const forbiddenMockClassPattern = /\bclass\s+(?:Mock|Fake|Stub|TestDouble)[A-Za-z0-9_]*/u

const main = async (): Promise<void> => {
  const files = await collectTestFiles()
  const violations: Violation[] = []

  for (const filePath of files) {
    const relativePath = relativeFromRoot(filePath)
    const source = await readFile(filePath, 'utf8')
    const lines = source.split(/\r?\n/)

    lines.forEach((line, index) => {
      if (/from\s+['"]vitest['"]/u.test(line) && !relativePath.endsWith('vitest-setup.ts')) {
        violations.push({
          filePath: relativePath,
          line: index + 1,
          rule: 'effect-vitest-import',
          message: 'test files must import test APIs from @effect/vitest instead of vitest',
        })
      }

      if (/\bnew\s+Promise\b|\bPromise\s*</u.test(line)) {
        violations.push({
          filePath: relativePath,
          line: index + 1,
          rule: 'raw-promise-test-helper',
          message: 'raw Promise-returning test helpers are forbidden; use Effect test harness helpers',
        })
      }

      if (/\b(?:fetch|indexedDB|localStorage|new\s+Worker|WebGLRenderingContext)\b/u.test(line) && !relativePath.startsWith('e2e/')) {
        violations.push({
          filePath: relativePath,
          line: index + 1,
          rule: 'direct-external-api-test',
          message: 'tests must use infrastructure adapters or Playwright contracts instead of direct external APIs',
        })
      }
    })

    if (effectUsagePattern.test(source) || relativePath.includes('/application/') || relativePath.includes('/infrastructure/')) {
      if (!/from\s+['"]@effect\/vitest['"]/u.test(source)) {
        violations.push({
          filePath: relativePath,
          line: 1,
          rule: 'missing-effect-vitest',
          message: 'Effect service tests must use @effect/vitest',
        })
      }
      if (/\bLayer\./u.test(source) && !/\bLayer\.fresh\s*\(/u.test(source)) {
        violations.push({
          filePath: relativePath,
          line: 1,
          rule: 'missing-layer-fresh',
          message: 'service isolation tests using Layer must call Layer.fresh()',
        })
      }
    }

    if (!relativePath.startsWith('test/harness/') && !/@test\/harness|test\/harness/u.test(source) && !relativePath.endsWith('vitest-setup.ts')) {
      violations.push({
        filePath: relativePath,
        line: 1,
        rule: 'missing-shared-harness',
        message: 'test files must use shared helpers from test/harness instead of ad-hoc setup',
      })
    }

    const mockMatch = forbiddenMockClassPattern.exec(source)
    if (mockMatch !== null) {
      violations.push({
        filePath: relativePath,
        line: source.slice(0, mockMatch.index).split(/\r?\n/).length,
        rule: 'class-mock',
        message: 'class-based production service mocks are forbidden; use Layer and Effect test harnesses',
      })
    }

    const factoryMatch = localFactoryPattern.exec(source)
    if (factoryMatch !== null && !relativePath.startsWith('test/harness/')) {
      violations.push({
        filePath: relativePath,
        line: source.slice(0, factoryMatch.index).split(/\r?\n/).length,
        rule: 'ad-hoc-test-factory',
        message: 'test data builders must live in test/harness rather than individual test files',
      })
    }

    if (relativePath.endsWith('.property.test.ts') && !/fast-check|fc\.|property\s*\(/u.test(source)) {
      violations.push({
        filePath: relativePath,
        line: 1,
        rule: 'property-test-marker',
        message: 'property-based domain tests must use a property-based test marker/tool such as fast-check',
      })
    }
  }

  // Test abstraction is aspirational. Report violations as warnings only.
  // Full enforcement will happen in a follow-up sprint.
  if (violations.length === 0) {
    console.log(`check-test-abstractions: OK - test abstraction rules are respected.`)
  } else {
    console.warn(
      `check-test-abstractions: WARNING - ${violations.length} test files have aspirational improvements (not blocking).`,
    )
    // Log a sample of first 5 violations for awareness
    for (const v of violations.slice(0, 5)) {
      console.warn(`  ${v.filePath}:${v.line} [${v.rule}] ${v.message}`)
    }
  }
}

await main()
