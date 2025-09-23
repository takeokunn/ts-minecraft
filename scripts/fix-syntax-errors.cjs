#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// Find all spec.ts files
const specFiles = glob.sync('src/**/__test__/*.spec.ts');

console.log(`Found ${specFiles.length} test files to fix`);

specFiles.forEach((file, index) => {
  try {
    let content = fs.readFileSync(file, 'utf8');
    const original = content;

    // Fix it.effect syntax with proper parentheses
    // Pattern 1: Fix it.effect with extra closing parenthesis
    content = content.replace(
      /it\.effect\('([^']+)',\s*\(\)\s*=>\s*Effect\.gen\(function\*\s*\(\)\s*\{([^}]+)\}\)\s*\)\s*\)/g,
      "it.effect('$1', () =>\n    Effect.gen(function* () {$2})\n  )"
    );

    // Pattern 2: Fix it.effect missing semicolons
    content = content.replace(
      /(\}\)\s*\))\s*$/gm,
      '$1'
    );

    // Pattern 3: Add semicolons after it.effect blocks
    content = content.replace(
      /(it\.effect\([^)]+\)\s*=>\s*Effect\.gen\([^)]+\)\s*\))\s*\n\s*it\./g,
      '$1\n\n  it.'
    );

    // Pattern 4: Fix describe blocks that are missing closing
    content = content.replace(
      /describe\('([^']+)',\s*\(\)\s*=>\s*\{/g,
      "describe('$1', () => {"
    );

    // Pattern 5: Fix double closing parenthesis at end of it.effect
    content = content.replace(
      /\}\)\s*\)\s*\)\s*$/gm,
      '  })\n  )'
    );

    // Pattern 6: Fix Effect.gen formatting
    content = content.replace(
      /Effect\.gen\(function\*\s*\(\)\s*\{\s*\n\s*\n/g,
      'Effect.gen(function* () {\n'
    );

    // Pattern 7: Remove duplicate empty lines
    content = content.replace(/\n\n\n+/g, '\n\n');

    // Pattern 8: Fix closing of it.effect - ensure proper structure
    content = content.replace(
      /it\.effect\(([^,]+),\s*\(\)\s*=>\s*\n\s*Effect\.gen\(function\*\s*\(\)\s*\{([^]*?)\}\)\s*\n\s*\)\s*\)/gm,
      'it.effect($1, () =>\n    Effect.gen(function* () {$2})\n  )'
    );

    // Pattern 9: Ensure proper closing for test files
    if (!content.trim().endsWith(')')) {
      if (content.includes('describe(')) {
        content = content.trim() + '\n})\n';
      }
    }

    if (content !== original) {
      fs.writeFileSync(file, content);
      console.log(`✓ Fixed ${file}`);
    }
  } catch (error) {
    console.error(`✗ Error fixing ${file}:`, error.message);
  }
});

console.log('Syntax fix complete!');