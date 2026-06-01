import { readFile } from 'node:fs/promises'
import {
  collectPackageLayerFiles,
  getPackageLayer,
  isTestFile,
  printViolationsAndExit,
  relativeFromRoot,
  stripCommentsAndStrings,
  type Violation,
} from './check-utils.ts'

const checkName = 'check-effect-compliance'

const restrictedLayers = new Set(['domain', 'application'])

const forbiddenPatterns: ReadonlyArray<{ readonly rule: string; readonly pattern: RegExp; readonly message: string }> = [
  { rule: 'raw-promise', pattern: /\b(?:new\s+Promise|Promise\s*<|Promise\.(?:resolve|reject|all|race|allSettled|any))\b/gu, message: 'raw Promise is forbidden in domain/application; return Effect instead' },
  { rule: 'try-catch', pattern: /\btry\s*\{|\bcatch\s*(?:\([^)]*\))?\s*\{/gu, message: 'try/catch is forbidden in domain/application; use Effect.try/Effect.tryPromise at boundaries' },
  { rule: 'throw', pattern: /\bthrow\b/gu, message: 'throw is forbidden in domain/application; use typed Effect failures/Data.TaggedError' },
  { rule: 'async-function', pattern: /\basync\s+function\b|\basync\s*\([^)]*\)\s*=>|\basync\s+[A-Za-z_$][\w$]*\s*\(/gu, message: 'async functions are forbidden in domain/application; return Effect values' },
]

const runPromisePattern = /\bEffect\.runPromise(?:Exit)?\s*\(/gu

const isBootstrapOrTestFile = (relativePath: string): boolean =>
  isTestFile(relativePath) ||
  relativePath === 'src/main.ts' ||
  relativePath.includes('/main/') ||
  relativePath.includes('/bootstrap') ||
  relativePath.includes('/entrypoint')

const hasEffectBoundaryComment = (source: string): boolean => /@effect-boundary\b/u.test(source.slice(0, 1200))

const main = async (): Promise<void> => {
  const files = await collectPackageLayerFiles()
  const violations: Violation[] = []

  for (const filePath of files) {
    const relativePath = relativeFromRoot(filePath)
    const layer = getPackageLayer(relativePath)
    const source = await readFile(filePath, 'utf8')
    const codeOnly = stripCommentsAndStrings(source)

    const boundaryAllowed =
      (layer === 'infrastructure' && hasEffectBoundaryComment(source)) ||
      (isBootstrapOrTestFile(relativePath) && !isTestFile(relativePath))
    const mustRejectRaw = (restrictedLayers.has(layer ?? '') && !boundaryAllowed) || (layer === 'infrastructure' && !boundaryAllowed)

    if (mustRejectRaw) {
      for (const rule of forbiddenPatterns) {
        rule.pattern.lastIndex = 0
        for (const match of codeOnly.matchAll(rule.pattern)) {
          if (isTestFile(relativePath) && rule.rule === 'async-function') {
            continue
          }
          violations.push({
            filePath: relativePath,
            line: codeOnly.slice(0, match.index).split(/\r?\n/).length,
            rule: rule.rule,
            message: layer === 'infrastructure' ? `${rule.message}; infrastructure exceptions require @effect-boundary` : rule.message,
          })
        }
      }
    }

    runPromisePattern.lastIndex = 0
    for (const match of codeOnly.matchAll(runPromisePattern)) {
      if (!isBootstrapOrTestFile(relativePath)) {
        violations.push({
          filePath: relativePath,
          line: codeOnly.slice(0, match.index).split(/\r?\n/).length,
          rule: 'effect-run-promise',
          message: 'Effect.runPromise is only allowed in tests or final app/bootstrap entrypoints',
        })
      }
    }
  }

  printViolationsAndExit(checkName, 'Effect usage follows ADR boundary rules.', violations)
}

await main()
