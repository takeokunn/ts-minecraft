#!/usr/bin/env tsx
/**
 * forループ → Stream API 変換ツール
 * TypeScript Compiler APIを使用してforループを自動変換
 */

import * as ts from 'typescript'
import * as fs from 'fs/promises'
import * as path from 'path'

// 変換設定
interface TransformationConfig {
  dryRun: boolean
  targetFiles: string[]
  patterns: ('simple-iteration' | 'range-iteration' | 'nested-loop')[]
  chunkSize: number
  enableParallel: boolean
}

// 変換結果
interface TransformationResult {
  file: string
  originalCode: string
  transformedCode: string
  changes: TransformationChange[]
  success: boolean
  errors: string[]
}

interface TransformationChange {
  line: number
  type: 'for-to-stream' | 'import-added' | 'yield-wrapped'
  before: string
  after: string
}

class ForLoopTransformer {
  private sourceFile?: ts.SourceFile
  private changes: TransformationChange[] = []
  private hasStreamImport = false

  async transformFile(filePath: string, config: TransformationConfig): Promise<TransformationResult> {
    try {
      const content = await fs.readFile(filePath, 'utf-8')

      // TypeScript AST解析
      this.sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true)

      // Streamインポートの有無を確認
      this.hasStreamImport = this.checkStreamImport()

      // forループを変換
      const transformer: ts.TransformerFactory<ts.Node> = (context) => {
        return (rootNode) => {
          const visit = (node: ts.Node): ts.Node => {
            // forループノードを検出
            if (ts.isForStatement(node)) {
              return this.transformForStatement(node, config)
            } else if (ts.isForOfStatement(node)) {
              return this.transformForOfStatement(node, config)
            }

            return ts.visitEachChild(node, visit, context)
          }

          return ts.visitNode(rootNode, visit)
        }
      }

      // 変換実行
      const result = ts.transform(this.sourceFile, [transformer])
      const transformedSourceFile = result.transformed[0] as ts.SourceFile

      // コード生成
      const printer = ts.createPrinter()
      let transformedCode = printer.printFile(transformedSourceFile)

      // Streamインポートを追加（必要な場合）
      if (!this.hasStreamImport && this.changes.length > 0) {
        transformedCode = this.addStreamImport(transformedCode)
      }

      // ファイル書き込み（dry-runでない場合）
      if (!config.dryRun) {
        await fs.writeFile(filePath, transformedCode, 'utf-8')
      }

      return {
        file: filePath,
        originalCode: content,
        transformedCode,
        changes: this.changes,
        success: true,
        errors: [],
      }
    } catch (error) {
      return {
        file: filePath,
        originalCode: '',
        transformedCode: '',
        changes: [],
        success: false,
        errors: [String(error)],
      }
    }
  }

  private checkStreamImport(): boolean {
    if (!this.sourceFile) return false

    const hasEffectImport = this.sourceFile.statements.some((statement) => {
      if (ts.isImportDeclaration(statement)) {
        const moduleSpecifier = statement.moduleSpecifier
        if (ts.isStringLiteral(moduleSpecifier)) {
          if (moduleSpecifier.text === 'effect') {
            // インポート指定子をチェック
            const importClause = statement.importClause
            if (importClause?.namedBindings && ts.isNamedImports(importClause.namedBindings)) {
              return importClause.namedBindings.elements.some((element) => element.name.text === 'Stream')
            }
          }
        }
      }
      return false
    })

    return hasEffectImport
  }

  private transformForStatement(node: ts.ForStatement, config: TransformationConfig): ts.Node {
    // for (let i = 0; i < n; i++) パターンを検出
    if (this.isRangeIterationPattern(node)) {
      return this.createRangeStreamNode(node, config)
    }

    // 複雑なforループは現状維持
    return node
  }

  private transformForOfStatement(node: ts.ForOfStatement, config: TransformationConfig): ts.Node {
    // for (const item of items) パターンを変換
    return this.createIterationStreamNode(node, config)
  }

  private isRangeIterationPattern(node: ts.ForStatement): boolean {
    // for (let i = 0; i < n; i++) のパターンマッチング
    if (!node.initializer || !node.condition || !node.incrementor) {
      return false
    }

    // 初期化: let i = 0
    if (ts.isVariableDeclarationList(node.initializer)) {
      const declaration = node.initializer.declarations[0]
      if (declaration.initializer && ts.isNumericLiteral(declaration.initializer)) {
        const initValue = parseInt(declaration.initializer.text)
        if (initValue === 0) {
          return true
        }
      }
    }

    return false
  }

  private createRangeStreamNode(node: ts.ForStatement, config: TransformationConfig): ts.Node {
    const printer = ts.createPrinter()
    const originalCode = printer.printNode(ts.EmitHint.Unspecified, node, this.sourceFile!)

    // 変数名と上限を抽出
    let variableName = 'i'
    let upperBound = 'unknown'

    if (node.initializer && ts.isVariableDeclarationList(node.initializer)) {
      const declaration = node.initializer.declarations[0]
      variableName = declaration.name.getText()
    }

    if (node.condition && ts.isBinaryExpression(node.condition)) {
      upperBound = node.condition.right.getText()
    }

    // Stream API コードを生成
    const streamCode = this.generateRangeStreamCode(variableName, upperBound, node.statement, config)

    this.changes.push({
      line: this.sourceFile!.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      type: 'for-to-stream',
      before: originalCode,
      after: streamCode,
    })

    // 新しいAST ノードを作成
    return this.createStreamExpressionNode(streamCode)
  }

  private createIterationStreamNode(node: ts.ForOfStatement, config: TransformationConfig): ts.Node {
    const printer = ts.createPrinter()
    const originalCode = printer.printNode(ts.EmitHint.Unspecified, node, this.sourceFile!)

    const variableName = node.initializer.getText().replace(/^const\s+/, '')
    const iterableName = node.expression.getText()

    // Stream API コードを生成
    const streamCode = this.generateIterationStreamCode(variableName, iterableName, node.statement, config)

    this.changes.push({
      line: this.sourceFile!.getLineAndCharacterOfPosition(node.getStart()).line + 1,
      type: 'for-to-stream',
      before: originalCode,
      after: streamCode,
    })

    return this.createStreamExpressionNode(streamCode)
  }

  private generateRangeStreamCode(
    variableName: string,
    upperBound: string,
    statement: ts.Statement,
    config: TransformationConfig
  ): string {
    const printer = ts.createPrinter()
    const statementCode = printer.printNode(ts.EmitHint.Unspecified, statement, this.sourceFile!)

    // ブロック文の中身を抽出
    let bodyCode = statementCode
    if (statementCode.startsWith('{') && statementCode.endsWith('}')) {
      bodyCode = statementCode.slice(1, -1).trim()
    }

    // チャンク処理を考慮
    const chunkProcessing = config.chunkSize > 1 ? `.pipe(Stream.chunks(${config.chunkSize}))` : ''

    // 並列処理を考慮
    const parallelProcessing = config.enableParallel
      ? `.pipe(Stream.mapConcurrently(4, (${variableName}) => Effect.gen(function* () {\n        ${bodyCode.replace(/\n/g, '\n        ')}\n      })))`
      : `.pipe(Stream.runForEach((${variableName}) => Effect.gen(function* () {\n        ${bodyCode.replace(/\n/g, '\n        ')}\n      })))`

    return `yield* Stream.range(0, ${upperBound} - 1)${chunkProcessing}${parallelProcessing}`
  }

  private generateIterationStreamCode(
    variableName: string,
    iterableName: string,
    statement: ts.Statement,
    config: TransformationConfig
  ): string {
    const printer = ts.createPrinter()
    const statementCode = printer.printNode(ts.EmitHint.Unspecified, statement, this.sourceFile!)

    let bodyCode = statementCode
    if (statementCode.startsWith('{') && statementCode.endsWith('}')) {
      bodyCode = statementCode.slice(1, -1).trim()
    }

    const chunkProcessing = config.chunkSize > 1 ? `.pipe(Stream.chunks(${config.chunkSize}))` : ''

    const parallelProcessing = config.enableParallel
      ? `.pipe(Stream.mapConcurrently(4, (${variableName}) => Effect.gen(function* () {\n        ${bodyCode.replace(/\n/g, '\n        ')}\n      })))`
      : `.pipe(Stream.runForEach((${variableName}) => Effect.gen(function* () {\n        ${bodyCode.replace(/\n/g, '\n        ')}\n      })))`

    return `yield* Stream.fromIterable(${iterableName})${chunkProcessing}${parallelProcessing}`
  }

  private createStreamExpressionNode(code: string): ts.Node {
    // 文字列からAST ノードを作成
    const sourceFile = ts.createSourceFile('temp.ts', code, ts.ScriptTarget.Latest, true)
    return sourceFile.statements[0]
  }

  private addStreamImport(code: string): string {
    const lines = code.split('\n')
    let importInserted = false

    // 既存のeffectインポートを探す
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      if (line.includes('import') && line.includes("from 'effect'")) {
        // Stream を既存のインポートに追加
        if (!line.includes('Stream')) {
          lines[i] = line.replace(/\}(\s*from\s*'effect')/, ', Stream }$1')
          importInserted = true
          break
        }
      }
    }

    // 新しいインポートを追加
    if (!importInserted) {
      const firstImportIndex = lines.findIndex((line) => line.includes('import'))
      const importLine = "import { Stream } from 'effect'"

      if (firstImportIndex >= 0) {
        lines.splice(firstImportIndex, 0, importLine)
      } else {
        lines.unshift(importLine)
      }

      this.changes.push({
        line: firstImportIndex + 1,
        type: 'import-added',
        before: '',
        after: importLine,
      })
    }

    return lines.join('\n')
  }
}

// ヘルパー関数
async function findTypeScriptFiles(dir: string, filter?: string): Promise<string[]> {
  const files: string[] = []

  async function traverse(currentDir: string) {
    const entries = await fs.readdir(currentDir, { withFileTypes: true })

    for (const entry of entries) {
      const fullPath = path.join(currentDir, entry.name)

      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
          // フィルター指定がある場合はパスに含まれるかチェック
          if (!filter || fullPath.includes(filter)) {
            await traverse(fullPath)
          }
        }
      } else if (entry.isFile()) {
        if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
          // フィルター指定がある場合はパスに含まれるかチェック
          if (!filter || fullPath.includes(filter)) {
            files.push(fullPath)
          }
        }
      }
    }
  }

  await traverse(dir)
  return files
}

// CLI実行
async function main() {
  const args = process.argv.slice(2)
  const config: TransformationConfig = {
    dryRun: args.includes('--dry-run'),
    targetFiles: [],
    patterns: ['simple-iteration', 'range-iteration'],
    chunkSize: 1000,
    enableParallel: false,
  }

  // ターゲットファイル指定
  if (args.includes('--test')) {
    config.targetFiles = await findTypeScriptFiles('src', '__test__')
  } else if (args.includes('--all')) {
    config.targetFiles = await findTypeScriptFiles('src')
  } else {
    // デフォルト: テストファイルのみ
    config.targetFiles = await findTypeScriptFiles('src', '__test__')
  }

  console.log(`🔄 ${config.targetFiles.length}個のファイルを変換開始...`)
  if (config.dryRun) {
    console.log('🧪 Dry-runモード: ファイルは変更されません')
  }

  const transformer = new ForLoopTransformer()
  const results: TransformationResult[] = []

  for (const file of config.targetFiles) {
    console.log(`📝 処理中: ${file}`)
    const result = await transformer.transformFile(file, config)
    results.push(result)

    if (result.success) {
      console.log(`  ✅ ${result.changes.length}個の変換を実行`)
    } else {
      console.log(`  ❌ エラー: ${result.errors.join(', ')}`)
    }
  }

  // サマリー表示
  const successCount = results.filter((r) => r.success).length
  const totalChanges = results.reduce((sum, r) => sum + r.changes.length, 0)

  console.log(`\n📊 変換完了:`)
  console.log(`  - 成功ファイル: ${successCount}/${results.length}`)
  console.log(`  - 総変更数: ${totalChanges}`)

  if (config.dryRun) {
    console.log(`\n💡 実際に変換するには --dry-run を外して実行してください`)
  }
}

if (require.main === module) {
  main().catch(console.error)
}

export { ForLoopTransformer, type TransformationConfig, type TransformationResult }
