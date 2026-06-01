import { readFile } from 'node:fs/promises'
import { collectPackageLayerFiles, parseImports, printViolationsAndExit, relativeFromRoot, stripCommentsAndStrings, type Violation } from './check-utils.ts'

const checkName = 'check-compat-removal'

const forbiddenPathSegments = /(?:^|\/)(?:legacy|migration|migrations|compat|deprecated)(?:\/|$)/iu
const forbiddenKeywordPattern = /\b(?:legacy|migrations?|compat(?:ibility)?|deprecatedSave|deprecated|migrateFrom|upgradeSave|backwards?\s+compatibility|fallback\s+save|old\s+save|old\s+version)\b/iu
const oldVersionBranchPattern = /\b(?:saveVersion|schemaVersion|worldVersion)\s*(?:<|<=|!==|!=)\s*(?:current|CURRENT|[0-9])/u

const main = async (): Promise<void> => {
  const files = await collectPackageLayerFiles()
  const violations: Violation[] = []

  for (const filePath of files) {
    const relativePath = relativeFromRoot(filePath)
    if (forbiddenPathSegments.test(relativePath)) {
      violations.push({
        filePath: relativePath,
        line: 1,
        rule: 'forbidden-path',
        message: 'legacy/migration/compat/deprecated paths are forbidden by ADR compatibility removal policy',
      })
    }

    const source = await readFile(filePath, 'utf8')
    for (const importRecord of parseImports(source)) {
      if (importRecord.specifier.startsWith('@ts-minecraft/furnace')) {
        violations.push({
          filePath: relativePath,
          line: importRecord.line,
          rule: 'furnace-import',
          message: '@ts-minecraft/furnace imports are forbidden; furnace belongs in inventory',
        })
      }
    }

    const lines = source.split(/\r?\n/)
    lines.forEach((line, index) => {
      if (forbiddenKeywordPattern.test(line)) {
        violations.push({
          filePath: relativePath,
          line: index + 1,
          rule: 'compat-keyword',
          message: 'legacy/migration/compat/deprecated compatibility keyword is forbidden',
        })
      }
    })

    const codeOnly = stripCommentsAndStrings(source)
    const branchMatch = oldVersionBranchPattern.exec(codeOnly)
    if (branchMatch !== null) {
      violations.push({
        filePath: relativePath,
        line: codeOnly.slice(0, branchMatch.index).split(/\r?\n/).length,
        rule: 'old-save-version-branch',
        message: 'old save version branches are forbidden; only the current save schema may exist',
      })
    }
  }

  printViolationsAndExit(checkName, 'compatibility and legacy migration code is absent.', violations)
}

await main()
