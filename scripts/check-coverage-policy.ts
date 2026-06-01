import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { collectFiles, collectProductionPackageFiles, collectTestFiles, isTypeScriptSource, printViolationsAndExit, relativeFromRoot, rootDir, type Violation } from './check-utils.ts'

const checkName = 'check-coverage-policy'

type Exclusion = {
  readonly pattern: string
  readonly line: number
  readonly comment: string
  readonly category: ExclusionCategory | undefined
  readonly reason: string
}

const exclusionCategories = ['PURE_TYPE', 'BARREL', 'BROWSER_ONLY', 'WORKER', 'TEST_UTILS'] as const
type ExclusionCategory = (typeof exclusionCategories)[number]

const categoryCommentPattern = /\b(PURE_TYPE|BARREL|BROWSER_ONLY|WORKER|TEST_UTILS):\s*(\S.*)$/u
const coverageCandidateFromSrc = path.join(rootDir, 'src', 'main.ts')

const isTypeOnlyOrBarrel = (relativePath: string, source: string): boolean => {
  if (relativePath.endsWith('/index.ts') || relativePath.endsWith('schemas.ts') || relativePath.endsWith('ports.ts')) {
    return true
  }
  const codeLines = source
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith('//') && !line.startsWith('/*') && !line.startsWith('*'))
  return codeLines.every((line) => /^(?:import\s|export\s+type|export\s+interface|export\s+\{|export\s+\*|type\s|interface\s|declare\s)/u.test(line))
}

const globToRegExp = (glob: string): RegExp => {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/gu, '\\$&')
    .replace(/\*\*\//gu, '(?:.*/)?')
    .replace(/\*\*/gu, '.*')
    .replace(/\*/gu, '[^/]*')
    .replace(/\?\(c\|m\)/gu, '(?:c|m)?')
    .replace(/\{js,ts\}/gu, '(?:js|ts)')
    .replace(/\{ts,tsx\}/gu, '(?:ts|tsx)')
  return new RegExp(`^${escaped}$`, 'u')
}

const matchesExclusion = (relativePath: string, exclusions: ReadonlyArray<Exclusion>): Exclusion | undefined =>
  exclusions.find((exclusion) => globToRegExp(exclusion.pattern).test(relativePath))

const extractCoverageExclusions = (source: string): ReadonlyArray<Exclusion> => {
  const coverageStart = source.indexOf('coverage: {')
  if (coverageStart === -1) {
    return []
  }
  const coverageExcludeStart = source.indexOf('exclude: [', coverageStart)
  if (coverageExcludeStart === -1) {
    return []
  }
  const coverageExcludeEnd = source.indexOf('],', coverageExcludeStart)
  const block = source.slice(coverageExcludeStart, coverageExcludeEnd)
  const baseLine = source.slice(0, coverageExcludeStart).split(/\r?\n/).length - 1
  const exclusions: Exclusion[] = []
  let currentComment = ''

  block.split(/\r?\n/).forEach((line, index) => {
    const comment = /\/\/\s*(.*)$/u.exec(line)?.[1]
    if (comment !== undefined) {
      currentComment = comment
    }
    const pattern = /['"]([^'"]+)['"]/u.exec(line)?.[1]
    if (pattern !== undefined) {
      const categoryMatch = categoryCommentPattern.exec(currentComment)
      exclusions.push({
        pattern,
        line: baseLine + index + 1,
        comment: currentComment,
        category: categoryMatch?.[1] as ExclusionCategory | undefined,
        reason: categoryMatch?.[2] ?? '',
      })
    }
  })

  return exclusions
}

const hasContractTest = (relativePath: string, testSources: string): boolean => {
  const baseName = path.basename(relativePath, '.ts')
  const escapedRelativePath = relativePath.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const parentPaths = relativePath
    .split('/')
    .slice(0, -1)
    .map((_, index, parts) => parts.slice(0, index + 1).join('/'))
    .filter((candidate) => candidate.startsWith('packages/') || candidate.startsWith('src/'))
    .map((candidate) => candidate.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&'))
  return new RegExp(`@(?:playwright-)?contract[\\s\\S]{0,300}(?:${baseName}|${escapedRelativePath}|${parentPaths.join('|')})`, 'u').test(testSources)
}

const collectContractFiles = async (): Promise<ReadonlyArray<string>> => {
  const e2eDir = path.join(rootDir, 'e2e')
  return collectFiles(e2eDir, (absolutePath) => isTypeScriptSource(absolutePath))
}

const collectCoverageCandidateFiles = async (): Promise<ReadonlyArray<string>> => [
  ...(await collectProductionPackageFiles()),
  coverageCandidateFromSrc,
]

const isContractCategory = (category: ExclusionCategory | undefined): boolean => category === 'BROWSER_ONLY' || category === 'WORKER'
const isNoRuntimeCategory = (category: ExclusionCategory | undefined): boolean => category === 'PURE_TYPE' || category === 'BARREL'

const main = async (): Promise<void> => {
  const vitestConfigSource = await readFile(path.join(rootDir, 'vitest.config.ts'), 'utf8')
  const exclusions = extractCoverageExclusions(vitestConfigSource)
  const violations: Violation[] = []

  for (const exclusion of exclusions) {
    if (exclusion.category === undefined || exclusion.reason.trim().length === 0) {
      violations.push({
        filePath: 'vitest.config.ts',
        line: exclusion.line,
        rule: 'unclassified-coverage-exclusion',
        message: `coverage exclusion "${exclusion.pattern}" must be preceded by CATEGORY: reason (${exclusionCategories.join(', ')})`,
      })
    }
  }

  const productionFiles = await collectCoverageCandidateFiles()
  const testFiles = await collectTestFiles()
  const contractFiles = await collectContractFiles()
  const testSources = (await Promise.all([...testFiles, ...contractFiles].map((file) => readFile(file, 'utf8')))).join('\n')

  for (const filePath of productionFiles) {
    const relativePath = relativeFromRoot(filePath)
    const source = await readFile(filePath, 'utf8')
    const exclusion = matchesExclusion(relativePath, exclusions)
    if (exclusion === undefined) {
      continue
    }

    const typeOnlyOrBarrel = isTypeOnlyOrBarrel(relativePath, source)
    if (typeOnlyOrBarrel && isContractCategory(exclusion.category)) {
      violations.push({
        filePath: relativePath,
        line: 1,
        rule: 'misclassified-no-runtime-exclusion',
        message: `type/barrel-only file excluded by "${exclusion.pattern}" should use PURE_TYPE or BARREL, not ${exclusion.category ?? 'unclassified'}`,
      })
    }

    if (!isNoRuntimeCategory(exclusion.category) && (!isContractCategory(exclusion.category) || !hasContractTest(relativePath, testSources))) {
      violations.push({
        filePath: relativePath,
        line: 1,
        rule: 'excluded-without-contract',
        message: `runtime file excluded from Vitest coverage by "${exclusion.pattern}" must be BROWSER_ONLY/WORKER and have a Playwright @contract marker`,
      })
    }
  }

  printViolationsAndExit(checkName, 'coverage exclusions are classified and contract-backed.', violations)
}

await main()
