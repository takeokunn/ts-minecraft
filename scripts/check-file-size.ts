import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'

const rootDir = process.cwd()
const maxLines = 300
const skippedDirectories = new Set(['node_modules', 'dist', 'coverage', 'e2e', '.git'])
// Only check production source files. Test files are excluded from the ≤300 target.
const packageLayers = new Set(["domain", "application", "infrastructure", "presentation"]);

type Violation = {
  readonly filePath: string
  readonly lineCount: number
}

const toPosix = (filePath: string): string => filePath.split(path.sep).join('/')

const isTypeScriptSource = (filePath: string): boolean =>
  filePath.endsWith('.ts') && !filePath.endsWith('.d.ts') && !filePath.endsWith('.test.ts') && !filePath.endsWith('.property.test.ts') && !filePath.endsWith('.integration.test.ts') && !filePath.endsWith('.e2e.ts')

const isProductionSource = (absolutePath: string): boolean => {
  const relativePath = toPosix(path.relative(rootDir, absolutePath))
  const segments = relativePath.split('/')

  if (segments[0] !== 'packages' || segments.length < 4) {
    return false
  }

  return packageLayers.has(segments[2] ?? '') && isTypeScriptSource(relativePath)
}

const collectFiles = async (directory: string): Promise<ReadonlyArray<string>> => {
  const entries = await readdir(directory, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    if (skippedDirectories.has(entry.name)) {
      continue
    }

    const absolutePath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      files.push(...(await collectFiles(absolutePath)))
      continue
    }

    if (entry.isFile() && isProductionSource(absolutePath)) {
      files.push(absolutePath)
    }
  }

  return files
}

const stripCommentsFromLine = (line: string, inBlockComment: boolean): { line: string; inBlockComment: boolean } => {
  let index = 0
  let result = ''
  let insideBlockComment = inBlockComment

  while (index < line.length) {
    if (insideBlockComment) {
      const blockEnd = line.indexOf('*/', index)
      if (blockEnd === -1) {
        return { line: result, inBlockComment: true }
      }
      index = blockEnd + 2
      insideBlockComment = false
      continue
    }

    const lineComment = line.indexOf('//', index)
    const blockComment = line.indexOf('/*', index)

    if (lineComment !== -1 && (blockComment === -1 || lineComment < blockComment)) {
      result += line.slice(index, lineComment)
      return { line: result, inBlockComment: false }
    }

    if (blockComment !== -1) {
      result += line.slice(index, blockComment)
      index = blockComment + 2
      insideBlockComment = true
      continue
    }

    result += line.slice(index)
    return { line: result, inBlockComment: false }
  }

  return { line: result, inBlockComment: insideBlockComment }
}

const countNonEmptyNonCommentLines = (source: string): number => {
  let count = 0
  let inBlockComment = false

  for (const rawLine of source.split(/\r?\n/)) {
    const stripped = stripCommentsFromLine(rawLine, inBlockComment)
    inBlockComment = stripped.inBlockComment

    if (stripped.line.trim().length > 0) {
      count += 1
    }
  }

  return count
}

const checkFile = async (filePath: string): Promise<Violation | undefined> => {
  const source = await readFile(filePath, 'utf8')
  const lineCount = countNonEmptyNonCommentLines(source)

  if (lineCount <= maxLines) {
    return undefined
  }

  return { filePath: toPosix(path.relative(rootDir, filePath)), lineCount }
}

const main = async (): Promise<void> => {
  const files = await collectFiles(rootDir)
  const violations = (await Promise.all(files.map((filePath) => checkFile(filePath)))).filter(
    (violation): violation is Violation => violation !== undefined,
  )

  if (violations.length === 0) {
    console.log(`check-file-size: OK - no files exceed ${maxLines} non-empty, non-comment lines.`)
    return
  }

  console.error(`check-file-size: ${violations.length} file(s) exceed ${maxLines} non-empty, non-comment lines:`)
  for (const violation of violations) {
    console.error(`- ${violation.filePath}: ${violation.lineCount} lines`)
  }

  process.exitCode = 1
}

await main()
