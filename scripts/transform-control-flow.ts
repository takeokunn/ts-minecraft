#!/usr/bin/env tsx
import { Project, Node, SyntaxKind, SourceFile, IfStatement, SwitchStatement, TryStatement } from 'ts-morph'
import * as path from 'path'
import * as fs from 'fs'
import { Effect, pipe, Array as Arr, Option, Match } from 'effect'

// AST transformation script for converting control flow to Effect-TS patterns

const project = new Project({
  tsConfigFilePath: path.join(process.cwd(), 'tsconfig.json'),
})

interface TransformationResult {
  file: string
  transformations: number
  errors: string[]
}

const transformIfStatement = (ifStatement: IfStatement): string => {
  const condition = ifStatement.getCondition().getText()
  const thenStatement = ifStatement.getThenStatement().getText()
  const elseStatement = ifStatement.getElseStatement()

  // Simple null/undefined check
  if (condition.includes('!==') && (condition.includes('null') || condition.includes('undefined'))) {
    const variable = condition.split(/!==|===/).map((s) => s.trim())[0]
    if (elseStatement) {
      return `pipe(
        Option.fromNullable(${variable}),
        Option.match({
          onNone: () => ${elseStatement.getText()},
          onSome: (value) => ${thenStatement}
        })
      )`
    } else {
      return `pipe(
        Option.fromNullable(${variable}),
        Option.map((value) => ${thenStatement}),
        Option.getOrElse(() => undefined)
      )`
    }
  }

  // Boolean condition
  if (elseStatement) {
    return `pipe(
      ${condition},
      Match.value,
      Match.when(true, () => ${thenStatement}),
      Match.orElse(() => ${elseStatement.getText()})
    )`
  } else {
    return `Effect.when(
      () => ${condition},
      Effect.sync(() => ${thenStatement})
    )`
  }
}

const transformTypeofCheck = (node: Node): string | null => {
  const text = node.getText()
  const typeofMatch = text.match(/typeof\s+(\w+)\s*===\s*['"](\w+)['"]/)

  if (typeofMatch) {
    const [_, variable, type] = typeofMatch
    return `Predicate.is${type.charAt(0).toUpperCase() + type.slice(1)}(${variable})`
  }

  return null
}

const transformInstanceofCheck = (node: Node): string | null => {
  const text = node.getText()
  const instanceofMatch = text.match(/(\w+)\s+instanceof\s+(\w+)/)

  if (instanceofMatch) {
    const [_, variable, className] = instanceofMatch
    return `Predicate.isInstanceOf(${className})(${variable})`
  }

  return null
}

const transformSwitchStatement = (switchStatement: SwitchStatement): string => {
  const expression = switchStatement.getExpression().getText()
  const cases = switchStatement.getClauses()

  let matchCases: string[] = []
  let defaultCase: string | null = null

  cases.forEach((clause) => {
    if (Node.isCaseClause(clause)) {
      const caseExpression = clause.getExpression().getText()
      const statements = clause
        .getStatements()
        .map((s) => s.getText())
        .join('\n')
      matchCases.push(`Match.when(${caseExpression}, () => ${statements.replace(/break;?/, '')})`)
    } else if (Node.isDefaultClause(clause)) {
      const statements = clause
        .getStatements()
        .map((s) => s.getText())
        .join('\n')
      defaultCase = statements.replace(/break;?/, '')
    }
  })

  const matchChain = matchCases.join(',\n    ')
  const exhaustive = defaultCase ? `Match.orElse(() => ${defaultCase})` : 'Match.exhaustive'

  return `pipe(
    Match.value(${expression}),
    ${matchChain},
    ${exhaustive}
  )`
}

const transformTryCatchStatement = (tryStatement: TryStatement): string => {
  const tryBlock = tryStatement.getTryBlock().getText()
  const catchClause = tryStatement.getCatchClause()
  const finallyBlock = tryStatement.getFinallyBlock()

  let effectCode = `Effect.gen(function* () {
    ${tryBlock.replace(/^{|}$/g, '').trim()}
  })`

  if (catchClause) {
    const errorVariable = catchClause.getVariableDeclaration()?.getName() || 'error'
    const catchBlock = catchClause.getBlock().getText()

    effectCode = `pipe(
      ${effectCode},
      Effect.catchAll((${errorVariable}) => ${catchBlock.replace(/^{|}$/g, '').trim()})
    )`
  }

  if (finallyBlock) {
    const finallyContent = finallyBlock.getText()
    effectCode = `pipe(
      ${effectCode},
      Effect.ensuring(Effect.sync(() => ${finallyContent.replace(/^{|}$/g, '').trim()}))
    )`
  }

  return effectCode
}

const transformFile = (sourceFile: SourceFile): TransformationResult => {
  const filePath = sourceFile.getFilePath()
  let transformations = 0
  const errors: string[] = []

  try {
    // Add necessary imports if not present
    const effectImport = sourceFile.getImportDeclaration('effect')
    if (!effectImport) {
      sourceFile.addImportDeclaration({
        moduleSpecifier: 'effect',
        namedImports: ['Effect', 'pipe', 'Option', 'Match', 'Predicate', 'Stream'],
      })
    }

    // Transform if statements
    sourceFile.getDescendantsOfKind(SyntaxKind.IfStatement).forEach((ifStatement) => {
      try {
        const transformed = transformIfStatement(ifStatement)
        ifStatement.replaceWithText(transformed)
        transformations++
      } catch (e) {
        errors.push(`Failed to transform if statement: ${e}`)
      }
    })

    // Transform switch statements
    sourceFile.getDescendantsOfKind(SyntaxKind.SwitchStatement).forEach((switchStatement) => {
      try {
        const transformed = transformSwitchStatement(switchStatement)
        switchStatement.replaceWithText(transformed)
        transformations++
      } catch (e) {
        errors.push(`Failed to transform switch statement: ${e}`)
      }
    })

    // Transform try-catch statements
    sourceFile.getDescendantsOfKind(SyntaxKind.TryStatement).forEach((tryStatement) => {
      try {
        const transformed = transformTryCatchStatement(tryStatement)
        tryStatement.replaceWithText(transformed)
        transformations++
      } catch (e) {
        errors.push(`Failed to transform try-catch statement: ${e}`)
      }
    })

    // Transform typeof checks
    sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).forEach((binaryExpr) => {
      const text = binaryExpr.getText()
      if (text.includes('typeof')) {
        try {
          const transformed = transformTypeofCheck(binaryExpr)
          if (transformed) {
            binaryExpr.replaceWithText(transformed)
            transformations++
          }
        } catch (e) {
          errors.push(`Failed to transform typeof check: ${e}`)
        }
      }
    })

    // Transform instanceof checks
    sourceFile.getDescendantsOfKind(SyntaxKind.BinaryExpression).forEach((binaryExpr) => {
      const text = binaryExpr.getText()
      if (text.includes('instanceof')) {
        try {
          const transformed = transformInstanceofCheck(binaryExpr)
          if (transformed) {
            binaryExpr.replaceWithText(transformed)
            transformations++
          }
        } catch (e) {
          errors.push(`Failed to transform instanceof check: ${e}`)
        }
      }
    })

    // Save the transformed file
    sourceFile.saveSync()
  } catch (e) {
    errors.push(`General transformation error: ${e}`)
  }

  return {
    file: filePath,
    transformations,
    errors,
  }
}

const main = async () => {
  console.log('🚀 Starting Effect-TS control flow transformation...\n')

  const directories = [
    'src/bootstrap',
    'src/shared',
    'src/domain',
    'src/infrastructure',
    'src/application',
    'src/presentation',
    'src/client',
    'src/server',
  ]

  const results: TransformationResult[] = []
  let totalTransformations = 0
  let totalErrors = 0

  for (const dir of directories) {
    const dirPath = path.join(process.cwd(), dir)
    if (!fs.existsSync(dirPath)) {
      console.log(`⚠️  Directory ${dir} does not exist, skipping...`)
      continue
    }

    console.log(`📁 Processing ${dir}...`)
    const sourceFiles = project.getSourceFiles(`${dir}/**/*.ts`)

    for (const sourceFile of sourceFiles) {
      // Skip test files
      if (sourceFile.getFilePath().includes('.test.') || sourceFile.getFilePath().includes('.spec.')) {
        continue
      }

      const result = transformFile(sourceFile)
      results.push(result)
      totalTransformations += result.transformations
      totalErrors += result.errors.length

      if (result.transformations > 0) {
        console.log(`  ✅ ${path.basename(result.file)}: ${result.transformations} transformations`)
      }

      if (result.errors.length > 0) {
        console.log(`  ❌ ${path.basename(result.file)}: ${result.errors.length} errors`)
        result.errors.forEach((err) => console.log(`     - ${err}`))
      }
    }
  }

  console.log('\n📊 Transformation Summary:')
  console.log(`Total transformations: ${totalTransformations}`)
  console.log(`Total errors: ${totalErrors}`)
  console.log(`Files processed: ${results.length}`)

  // Final validation
  console.log('\n🔍 Running final validation...')
  const validationScript = `
    echo "=== Final Control Flow Check ==="
    echo "if statements: $(grep -r "if (" src --include="*.ts" | wc -l)"
    echo "else if: $(grep -r "else if" src --include="*.ts" | wc -l)"
    echo "switch: $(grep -r "switch (" src --include="*.ts" | wc -l)"
    echo "try-catch: $(grep -r "try {" src --include="*.ts" | wc -l)"
    echo "instanceof: $(grep -r "instanceof " src --include="*.ts" | wc -l)"
    echo "typeof: $(grep -r "typeof .* ===" src --include="*.ts" | wc -l)"
  `

  const { exec } = require('child_process')
  exec(validationScript, (error: any, stdout: string, stderr: string) => {
    if (!error) {
      console.log(stdout)
    }
  })
}

// Run the transformation
main().catch(console.error)
