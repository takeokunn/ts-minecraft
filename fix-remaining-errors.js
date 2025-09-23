#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// より高度なTypeScript修正パターン
class AdvancedTypeScriptFixer {
  constructor() {
    this.fixPatterns = [
      // describe の不正な構文修正
      {
        name: 'describe block fix',
        pattern: /describe\(([^,]+),\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*\)/g,
        replacement: (match, name, body) => {
          const cleanBody = this.cleanBlockBody(body);
          return `describe(${name}, () => {\n${cleanBody}\n})`;
        }
      },

      // it.effect の不正な構文修正
      {
        name: 'it.effect comprehensive fix',
        pattern: /it\.effect\(([^,]+),\s*\(\)\s*=>\s*([\s\S]*?)\n\s*\)/g,
        replacement: (match, name, body) => {
          const cleanBody = this.cleanItEffectBody(body);
          return `it.effect(${name}, () =>\n${cleanBody}\n)`;
        }
      },

      // 余分な括弧とセミコロン修正
      {
        name: 'extra syntax cleanup',
        pattern: /\}\s*\)\s*=>\s*\n/g,
        replacement: '})\n\n'
      },

      // 不正な閉じ括弧修正
      {
        name: 'malformed closing brackets',
        pattern: /\}\s*\)\s*\)\s*\n/g,
        replacement: '})\n'
      },

      // 複数行にわたる不正な構文修正
      {
        name: 'multiline syntax fix',
        pattern: /\)\s*=>\s*\n\s*Effect\.gen\(/g,
        replacement: ') =>\n  Effect.gen('
      }
    ];
  }

  // it.effect のボディを修正
  cleanItEffectBody(body) {
    // Effect.gen パターンを検出・修正
    if (body.includes('Effect.gen')) {
      return body
        .replace(/^\s*\n+/, '')  // 先頭の空行削除
        .replace(/\n+\s*$/, '')  // 末尾の空行削除
        .replace(/Effect\.gen\(function\*\s*\(\)\s*\{([\s\S]*?)\}\)/g, (match, genBody) => {
          const cleanGenBody = genBody
            .split('\n')
            .map(line => line.trim() ? `    ${line.replace(/^\s*/, '')}` : '')
            .join('\n')
            .replace(/^\s*\n/, '')  // 先頭空行削除
            .replace(/\n\s*$/, ''); // 末尾空行削除

          return `Effect.gen(function* () {\n${cleanGenBody}\n  })`;
        });
    }

    return `  ${body.replace(/^\s+/, '').replace(/\s+$/, '')}`;
  }

  // ブロックのボディを修正
  cleanBlockBody(body) {
    return body
      .replace(/^\s*\n+/, '')  // 先頭の空行削除
      .replace(/\n+\s*$/, '')  // 末尾の空行削除
      .split('\n')
      .map(line => line.trim() ? `  ${line.replace(/^\s*/, '')}` : '')
      .join('\n');
  }

  // ファイル修正実行
  fixFile(filePath) {
    console.log(`修正中: ${filePath}`);

    let content = fs.readFileSync(filePath, 'utf8');
    let originalContent = content;
    let appliedFixes = [];

    // 各パターンを適用
    for (const pattern of this.fixPatterns) {
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

    // 追加の修正処理
    content = this.advancedCleanup(content);

    // ファイルが変更された場合のみ書き込み
    if (content !== originalContent) {
      fs.writeFileSync(filePath, content, 'utf8');
      console.log(`  ✓ 修正完了: ${appliedFixes.join(', ')}`);
      return true;
    }

    return false;
  }

  // 高度なクリーンアップ処理
  advancedCleanup(content) {
    // 1. 不正な改行パターン修正
    content = content.replace(/\)\s*=>\s*\n\s*\n\s*/g, ') =>\n  ');

    // 2. 余分な括弧削除
    content = content.replace(/\}\)\s*\)\s*\)/g, '})');

    // 3. 不正な文の終了修正
    content = content.replace(/\}\s*\)\s*=>\s*$/gm, '})');

    // 4. 複数の連続した空行を単一に
    content = content.replace(/\n\s*\n\s*\n+/g, '\n\n');

    // 5. describe/it ブロックの正規化
    content = content.replace(
      /describe\(([^,]+),\s*\(\)\s*=>\s*\{([\s\S]*?)\}\s*\)/g,
      (match, name, body) => {
        const lines = body.split('\n');
        const indentedLines = lines.map(line => {
          if (line.trim() === '') return '';
          return line.startsWith('  ') ? line : `  ${line.replace(/^\s*/, '')}`;
        });
        const cleanBody = indentedLines.join('\n').replace(/^\s*\n/, '').replace(/\n\s*$/, '');
        return `describe(${name}, () => {\n${cleanBody}\n})`;
      }
    );

    // 6. it.effect ブロックの正規化
    content = content.replace(
      /it\.effect\(([^,]+),\s*\(\)\s*=>\s*\n\s*Effect\.gen\(function\*\s*\(\)\s*\{([\s\S]*?)\}\)\s*\n?\s*\)/g,
      (match, name, body) => {
        const cleanBody = body
          .split('\n')
          .map(line => line.trim() ? `    ${line.replace(/^\s*/, '')}` : '')
          .join('\n')
          .replace(/^\s*\n/, '')
          .replace(/\n\s*$/, '');

        return `it.effect(${name}, () =>\n  Effect.gen(function* () {\n${cleanBody}\n  })\n)`;
      }
    );

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
    console.log('高度な修正開始...\n');

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
      return true;
    } catch (error) {
      console.log('⚠️ まだエラーが残っています。');
      return false;
    }
  }
}

// メイン実行
if (import.meta.url === `file://${process.argv[1]}`) {
  const fixer = new AdvancedTypeScriptFixer();
  const success = fixer.fixAllTestFiles();

  process.exit(success ? 0 : 1);
}

export default AdvancedTypeScriptFixer;