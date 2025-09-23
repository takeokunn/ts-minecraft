#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// it.effect() 構文の最終修正
class FinalItEffectFixer {
  constructor() {
    this.patterns = [
      // it.effect の閉じ括弧修正
      {
        name: 'it.effect closing parentheses fix',
        pattern: /it\.effect\(([^,]+),\s*\(\)\s*=>\s*\n\s*Effect\.gen\(function\*\s*\(\)\s*\{([\s\S]*?)\}\)\s*\n\s*\)/g,
        replacement: (match, testName, body) => {
          const cleanBody = body
            .split('\n')
            .map(line => line.trim() ? `    ${line.replace(/^\s*/, '')}` : '')
            .join('\n')
            .replace(/^\s*\n/, '')
            .replace(/\n\s*$/, '');

          return `it.effect(${testName}, () =>\n  Effect.gen(function* () {\n${cleanBody}\n  })\n)`;
        }
      },

      // describe ブロックの修正
      {
        name: 'describe block fix',
        pattern: /describe\(([^,]+),\s*\(\)\s*=>\s*\{\s*([\s\S]*?)\s*\}\s*\)/g,
        replacement: (match, name, body) => {
          const cleanBody = body
            .split('\n')
            .map(line => line.trim() ? (line.startsWith('  ') ? line : `  ${line.replace(/^\s*/, '')}`) : '')
            .join('\n')
            .replace(/^\s*\n/, '')
            .replace(/\n\s*$/, '');

          return `describe(${name}, () => {\n${cleanBody}\n})`;
        }
      },

      // 不正な構文パターンの修正
      {
        name: 'fix invalid syntax patterns',
        pattern: /\}\)\s*\n\s*\)/g,
        replacement: '})\n)'
      },

      // 余分な括弧削除
      {
        name: 'remove extra brackets',
        pattern: /\}\)\s*\)\s*\n/g,
        replacement: '})\n\n'
      }
    ];
  }

  // ファイル修正実行
  fixFile(filePath) {
    console.log(`最終修正中: ${filePath}`);

    let content = fs.readFileSync(filePath, 'utf8');
    const originalContent = content;
    let appliedFixes = [];

    // 各パターンを適用
    for (const pattern of this.patterns) {
      const before = content;

      if (typeof pattern.replacement === 'function') {
        content = content.replace(pattern.pattern, pattern.replacement);
      } else {
        content = content.replace(pattern.pattern, pattern.replacement);
      }

      if (before !== content) {
        appliedFixes.push(pattern.name);
      }
    }

    // 詳細な構文修正
    content = this.detailedSyntaxFix(content);

    // ファイルが変更された場合のみ書き込み
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  ✓ 最終修正完了: ${appliedFixes.join(', ')}`);
      return true;
    }

    return false;
  }

  // 詳細な構文修正
  detailedSyntaxFix(content) {
    // 1. it.effect ブロックの正規化
    content = content.replace(
      /it\.effect\(([^,]+),\s*\(\)\s*=>\s*\n.*?Effect\.gen\(function\*\s*\(\)\s*\{([\s\S]*?)\}\)\s*\n.*?\)/g,
      (match, testName, testBody) => {
        // テストボディの整理
        const lines = testBody.split('\n');
        const cleanedLines = lines
          .filter(line => line.trim() !== '')
          .map(line => {
            const trimmed = line.trim();
            return trimmed ? `    ${trimmed}` : '';
          });

        const cleanBody = cleanedLines.join('\n');

        return `it.effect(${testName}, () =>\n  Effect.gen(function* () {\n${cleanBody}\n  })\n)`;
      }
    );

    // 2. describe ブロックの正規化
    content = content.replace(
      /describe\(([^,]+),\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*\)/g,
      (match, suiteName, suiteBody) => {
        const lines = suiteBody.split('\n');
        const cleanedLines = lines
          .filter(line => line.trim() !== '')
          .map(line => {
            const trimmed = line.trim();
            if (!trimmed) return '';
            if (line.startsWith('  ')) return line;
            return `  ${trimmed}`;
          });

        const cleanBody = cleanedLines.join('\n');

        return `describe(${suiteName}, () => {\n${cleanBody}\n})`;
      }
    );

    // 3. 複数の連続した空行を単一に
    content = content.replace(/\n\s*\n\s*\n+/g, '\n\n');

    // 4. ファイル末尾の整理
    content = content.replace(/\n+$/, '\n');

    return content;
  }

  // 指定ディレクトリ内の.spec.tsファイルを再帰的に検索
  findSpecFiles(dir) {
    const files = [];

    function traverse(currentDir) {
      const items = fs.readdirSync(currentDir);

      for (const item of items) {
        const itemPath = path.join(currentDir, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory()) {
          traverse(itemPath);
        } else if (item.endsWith('.spec.ts')) {
          files.push(itemPath);
        }
      }
    }

    traverse(dir);
    return files;
  }

  // 全てのテストファイルを最終修正
  fixAllTestFiles() {
    const srcDir = path.join(__dirname, 'src');
    const specFiles = this.findSpecFiles(srcDir);

    console.log(`検出されたテストファイル数: ${specFiles.length}`);
    console.log('最終修正開始...\n');

    let fixedCount = 0;

    for (const file of specFiles) {
      try {
        if (this.fixFile(file)) {
          fixedCount++;
        }
      } catch (error) {
        console.error(`エラー: ${file} - ${error.message}`);
      }
    }

    console.log(`\n最終修正完了: ${fixedCount}/${specFiles.length} ファイル`);

    // TypeScript チェック実行
    console.log('\n最終TypeScript チェック実行...');
    try {
      execSync('pnpm typecheck', { stdio: 'inherit' });
      console.log('✓ TypeScript チェック成功! 全てのエラーが修正されました!');
      return true;
    } catch (error) {
      console.log('⚠️ まだエラーが残っています。手動確認が必要です。');
      return false;
    }
  }
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const fixer = new FinalItEffectFixer();
  const success = fixer.fixAllTestFiles();

  if (success) {
    console.log('\n🎉 全てのTypeScriptエラーが修正されました!');
    console.log('📝 修正されたパターン:');
    console.log('  - it.effect() 構文の正規化');
    console.log('  - describe() ブロックの修正');
    console.log('  - 余分な括弧・空行の削除');
    console.log('  - 統一されたインデントの適用');
  }

  process.exit(success ? 0 : 1);
}

export default FinalItEffectFixer;