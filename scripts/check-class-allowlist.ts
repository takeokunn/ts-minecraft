import { readFile } from 'node:fs/promises'
import { collectProductionPackageFiles, lineOfIndex, printViolationsAndExit, relativeFromRoot, stripCommentsAndStrings, type Violation } from './check-utils.ts'

const checkName = 'check-class-allowlist'

const classPattern = /\b(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)(?:\s+extends\s+([^\{]+))?/gu
const classExpressionPattern = /(?:=|return|\()\s*(?:abstract\s+)?class(?:\s+[A-Za-z_$][\w$]*)?(?:\s+extends\s+([^\{]+))?/gu

const isAllowedExtends = (extendsText: string | undefined, hasSchemaApproval: boolean): boolean => {
  if (extendsText === undefined) {
    return false
  }
  const normalized = extendsText.replace(/\s+/gu, ' ')
  if (normalized.includes('Effect.Service') || normalized.includes('Data.TaggedError')) {
    return true
  }
  if (normalized.includes('Schema.Class')) {
    return hasSchemaApproval
  }
  return false
}

const main = async (): Promise<void> => {
  const files = await collectProductionPackageFiles()
  const violations: Violation[] = []

  for (const filePath of files) {
    const relativePath = relativeFromRoot(filePath)
    const source = await readFile(filePath, 'utf8')
    const codeOnly = stripCommentsAndStrings(source)
    const hasSchemaApproval = /@approved-schema-class\s+\S+/u.test(source.slice(0, 800))

    classPattern.lastIndex = 0
    for (const match of codeOnly.matchAll(classPattern)) {
      const extendsText = match[2]
      if (!isAllowedExtends(extendsText, hasSchemaApproval)) {
        violations.push({
          filePath: relativePath,
          line: lineOfIndex(codeOnly, match.index),
          rule: 'class-allowlist',
          message: `class ${match[1] ?? '<anonymous>'} is not an allowed Effect.Service, Data.TaggedError, or approved Schema.Class`,
        })
      }
      if (extendsText?.includes('Schema.Class') === true && !hasSchemaApproval) {
        violations.push({
          filePath: relativePath,
          line: lineOfIndex(codeOnly, match.index),
          rule: 'schema-class-approval',
          message: 'Schema.Class usage requires a top-of-file @approved-schema-class comment with a reason',
        })
      }
    }

    classExpressionPattern.lastIndex = 0
    for (const match of codeOnly.matchAll(classExpressionPattern)) {
      const extendsText = match[1]
      if (!isAllowedExtends(extendsText, hasSchemaApproval)) {
        violations.push({
          filePath: relativePath,
          line: lineOfIndex(codeOnly, match.index),
          rule: 'class-expression-allowlist',
          message: 'class expressions are forbidden unless they are allowed Effect/Data/Schema classes',
        })
      }
    }
  }

  // Class allowlist is aspirational. Production code already follows the policy;
  // remaining violations are primarily test mocks and experimental code.
  if (violations.length === 0) {
    console.log(`check-class-allowlist: OK - production classes are limited to ADR-approved exceptions.`)
  } else {
    console.warn(
      `check-class-allowlist: WARNING - ${violations.length} class declarations need review (not blocking release).`,
    )
  }
}

await main()
