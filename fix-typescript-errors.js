#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// TypeScript修正パターン
class TypeScriptFixer {
  constructor() {
    this.fixPatterns = [
      // it.effect() 構文修正
      {
        name: 'it.effect syntax fix',
        pattern: /it\.effect\(([^,]+),\s*\(\)\s*=>\s*\n\s*Effect\.gen\(function\*\s*\(\)\s*\{\s*([\s\S]*?)\s*\}\)\s*\)\s*\)/g,
        replacement: 'it.effect($1, () =>\n  Effect.gen(function* () {$2  })\n)'
      },

      // 二重閉じ括弧修正
      {
        name: 'double closing brackets',
        pattern: /\}\)\s*\)\s*\)/g,
        replacement: '})\n)'
      },

      // 余分な空行による構文分離修正
      {
        name: 'empty line syntax break',
        pattern: /it\.effect\(([^,]+),\s*\(\)\s*=>\s*\n\s*\n\s*Effect\.gen\(/g,
        replacement: 'it.effect($1, () =>\n  Effect.gen('
      },

      // Effect.gen の閉じ括弧修正
      {
        name: 'Effect.gen closing brackets',
        pattern: /Effect\.gen\(function\*\s*\(\)\s*\{\s*([\s\S]*?)\s*\}\)\s*\n\s*\)\s*\)/g,
        replacement: 'Effect.gen(function* () {\n$1  })\n)'
      },

      // for ループの余分な閉じ括弧修正
      {
        name: 'for loop extra bracket',
        pattern: /for\s*\([^)]+\)\s*\{([^}]*)\}\)/g,
        replacement: 'for ($1) {$2}'
      },

      // describe/it ブロックの構文修正
      {
        name: 'describe/it block syntax',
        pattern: /describe\(([^,]+),\s*\(\)\s*=>\s*\{\s*([\s\S]*?)\s*\}\s*\)\s*\)/g,
        replacement: 'describe($1, () => {$2})'
      },

      // 余分な括弧とセミコロン修正
      {
        name: 'extra brackets and semicolons',
        pattern: /\}\s*\)\s*\)\s*;/g,
        replacement: '})'
      },

      // 不正な空行削除
      {
        name: 'remove invalid empty lines',
        pattern: /\n\s*\n\s*\)/g,
        replacement: '\n)'
      }
    ];
  }

  // ファイル修正実行
  fixFile(filePath) {
    console.log(`修正中: ${filePath}`);

    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;

    // 各パターンを適用
    for (const pattern of this.fixPatterns) {
      const before = content;
      content = content.replace(pattern.pattern, pattern.replacement);
      if (before !== content) {
        console.log(`  ✓ 適用: ${pattern.name}`);
      }
    }

    // 追加の構文修正
    content = this.additionalFixes(content);

    // ファイルが変更された場合のみ書き込み
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  ✓ 修正完了: ${filePath}`);
      return true;
    }

    return false;
  }

  // 追加の構文修正
  additionalFixes(content) {
    // it.effect の構文を正規化
    content = content.replace(
      /it\.effect\(([^,]+),\s*\(\)\s*=>\s*\n.*?Effect\.gen\(function\*\s*\(\)\s*\{([\s\S]*?)\}\)\s*\n.*?\)/g,
      (match, testName, testBody) => {
        // テストボディを整理
        const cleanBody = testBody
          .replace(/^\s*\n+/, '')  // 先頭の空行削除
          .replace(/\n+\s*$/, '')  // 末尾の空行削除
          .split('\n')
          .map(line => line.trim() ? `    ${line.replace(/^\s*/, '')}` : '')
          .join('\n');

        return `it.effect(${testName}, () =>\n  Effect.gen(function* () {\n${cleanBody}\n  })\n)`;
      }
    );

    // describe ブロックの修正
    content = content.replace(
      /describe\(([^,]+),\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*\)/g,
      (match, suiteName, suiteBody) => {
        const cleanBody = suiteBody
          .replace(/^\s*\n+/, '')
          .replace(/\n+\s*$/, '');

        return `describe(${suiteName}, () => {\n${cleanBody}\n})`;
      }
    );

    // 余分な括弧とカンマの修正
    content = content.replace(/\}\s*,\s*\)\s*\)/g, '})\n)');
    content = content.replace(/\n\s*\)\s*\n\s*\)/g, '\n)');

    // 複数の連続した空行を単一に
    content = content.replace(/\n\s*\n\s*\n+/g, '\n\n');

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

  // 全てのテストファイルを修正
  fixAllTestFiles() {
    const srcDir = path.join(__dirname, 'src');
    const specFiles = this.findSpecFiles(srcDir);

    console.log(`検出されたテストファイル数: ${specFiles.length}`);
    console.log('修正開始...\n');

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

    console.log(`\n修正完了: ${fixedCount}/${specFiles.length} ファイル`);

    // TypeScript チェック実行
    console.log('\nTypeScript チェック実行...');
    try {
      execSync('pnpm typecheck', { stdio: 'inherit' });
      console.log('✓ TypeScript チェック成功!');
    } catch (error) {
      console.log('⚠️ まだエラーが残っています。追加修正が必要です。');
      return false;
    }

    return true;
  }
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const fixer = new TypeScriptFixer();
  const success = fixer.fixAllTestFiles();

  process.exit(success ? 0 : 1);
}

export default TypeScriptFixer;