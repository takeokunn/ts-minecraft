import { readFile } from 'node:fs/promises'
import {
  collectProductionPackageFiles,
  getPackageLayer,
  parseImports,
  printViolationsAndExit,
  relativeFromRoot,
  stripCommentsAndStrings,
  type Violation,
} from './check-utils.ts'

const checkName = 'check-data-logic-separation'

const forbiddenDomainRuntimePatterns: ReadonlyArray<{ readonly rule: string; readonly pattern: RegExp; readonly message: string }> = [
  { rule: 'date-in-domain', pattern: /\b(?:Date\.now|new\s+Date)\b/gu, message: 'domain/ must not read wall-clock time; inject time through application/infrastructure ports' },
  { rule: 'random-in-domain', pattern: /\bMath\.random\s*\(/gu, message: 'domain/ must not use Math.random; inject deterministic randomness through ports' },
  { rule: 'dom-in-domain', pattern: /\b(?:document|window|HTMLElement|MouseEvent|KeyboardEvent|Canvas|ImageBitmap)\b/gu, message: 'domain/ must not depend on DOM/browser APIs' },
  { rule: 'webgl-in-domain', pattern: /\b(?:WebGL|GPUDevice|GPUBuffer|THREE\.)\b/gu, message: 'domain/ must not depend on WebGL/THREE rendering APIs' },
  { rule: 'worker-in-domain', pattern: /\b(?:Worker|postMessage|MessagePort|DedicatedWorkerGlobalScope)\b/gu, message: 'domain/ must not depend on Worker APIs' },
  { rule: 'storage-in-domain', pattern: /\b(?:localStorage|sessionStorage|indexedDB|Storage)\b/gu, message: 'domain/ must not depend on browser storage APIs' },
]

const schemaBusinessLogicLinePattern = /\bSchema\.(?:Class|Struct|TaggedStruct|Union|transform|filter|decode|encode)\b.*\b(?:Effect\.|Date\.now|new\s+Date|Math\.random|fetch\s*\(|while\s*\(|for\s*\(|reduce\s*\(|set[A-Z]|update[A-Z]|calculate[A-Z]|apply[A-Z])\b/u
const infrastructureRulePattern = /\b(?:calculateRecipe|canCraft|applyDamage|updateWorld|tickEntity|resolveBlockDrop|placeBlockRule|consumeFuel|smeltRecipe)\b/gu

const main = async (): Promise<void> => {
  const files = await collectProductionPackageFiles()
  const violations: Violation[] = []

  for (const filePath of files) {
    const relativePath = relativeFromRoot(filePath)
    const layer = getPackageLayer(relativePath)
    const source = await readFile(filePath, 'utf8')
    const codeOnly = stripCommentsAndStrings(source)

    if (layer === 'domain') {
      for (const importRecord of parseImports(source)) {
        const isTypeOnlyImport = /^import\s+type\b/u.test(importRecord.text.trimStart())
        if (!isTypeOnlyImport && importRecord.specifier === 'effect' && /\b(?:Layer|Runtime|Fiber|Ref|Queue|Stream)\b/u.test(importRecord.text)) {
          violations.push({
            filePath: relativePath,
            line: importRecord.line,
            rule: 'effect-in-domain',
            message: 'domain/ may import Schema/Effect/Context from effect, but must not import Layer/Runtime/runtime services',
          })
        }
      }

      for (const rule of forbiddenDomainRuntimePatterns) {
        rule.pattern.lastIndex = 0
        for (const match of codeOnly.matchAll(rule.pattern)) {
          violations.push({
            filePath: relativePath,
            line: codeOnly.slice(0, match.index).split(/\r?\n/).length,
            rule: rule.rule,
            message: rule.message,
          })
        }
      }

      codeOnly.split(/\r?\n/).forEach((line, index) => {
        if (schemaBusinessLogicLinePattern.test(line)) {
          violations.push({
            filePath: relativePath,
            line: index + 1,
            rule: 'schema-business-logic',
            message: 'Schema definitions must be validation-only and must not contain business logic, effects, I/O, time, or randomness',
          })
        }
      })
    }

    if (layer === 'infrastructure') {
      infrastructureRulePattern.lastIndex = 0
      for (const match of codeOnly.matchAll(infrastructureRulePattern)) {
        violations.push({
          filePath: relativePath,
          line: codeOnly.slice(0, match.index).split(/\r?\n/).length,
          rule: 'domain-rule-in-infrastructure',
          message: 'infrastructure/ must adapt external APIs only and must not host domain rule implementations',
        })
      }
    }
  }

  if (violations.length === 0) {
    console.log(`check-data-logic-separation: OK - domain data and logic separation rules are respected.`)
  } else {
    console.warn(`check-data-logic-separation: ${violations.length} domain files mix data and logic.`)
    for (const v of violations) {
      console.warn(`  - ${v.filePath}:${v.line} [${v.rule}] ${v.message}`)
    }
  }
}

await main()
