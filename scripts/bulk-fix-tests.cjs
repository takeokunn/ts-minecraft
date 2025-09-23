#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

function findSpecFiles(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      findSpecFiles(fullPath, files);
    } else if (entry.isFile() && entry.name.endsWith('.spec.ts')) {
      files.push(fullPath);
    }
  }

  return files;
}

function hasConversionIssues(content) {
  // Check for malformed it.effect patterns that cause syntax errors
  return content.includes('it.effect(') && (
    content.includes('      })') || // Malformed closing
    content.includes('    })') ||   // Wrong indentation
    content.includes('  })') ||     // Wrong indentation
    /\n\s*\}\s*\)\s*\n\s*\}\s*\)\s*$/.test(content) // Double closing
  );
}

function bulkFixFile(content) {
  // Step 1: First, normalize all it.effect() patterns
  let result = content;

  // Fix malformed it.effect with broken structure
  result = result.replace(
    /(\s*)it\.effect\(([^,]+),\s*\(\)\s*=>\s*\n\s*Effect\.gen\(function\*\s*\(\)\s*\{\s*([\s\S]*?)\n\s*\}\s*\)\s*\n\s*\}\s*\)\s*\n\s*\)/gm,
    (match, indent, testName, testBody) => {
      // Clean the test body
      const lines = testBody.split('\n');
      const cleanedLines = [];

      for (let line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.match(/^\}+\)?$/)) {
          cleanedLines.push('        ' + trimmed);
        }
      }

      return `${indent}it.effect(${testName}, () =>\n${indent}  Effect.gen(function* () {\n${cleanedLines.join('\n')}\n${indent}  })\n${indent})`;
    }
  );

  // Fix another pattern: it.effect with Effect.gen on same line
  result = result.replace(
    /(\s*)it\.effect\(([^,]+),\s*\(\)\s*=>\s*Effect\.gen\(function\*\s*\(\)\s*\{\s*([\s\S]*?)\n\s*\}\)\s*\)/gm,
    (match, indent, testName, testBody) => {
      const lines = testBody.split('\n');
      const cleanedLines = lines
        .map(line => line.trim())
        .filter(line => line && !line.match(/^\}+\)?$/))
        .map(line => '        ' + line);

      return `${indent}it.effect(${testName}, () =>\n${indent}  Effect.gen(function* () {\n${cleanedLines.join('\n')}\n${indent}  })\n${indent})`;
    }
  );

  // Fix broken closing patterns
  result = result.replace(/\n\s*\}\s*\)\s*\n\s*\}\s*\)\s*$/gm, '');

  return result;
}

function processFile(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');

    if (!hasConversionIssues(content)) {
      return false;
    }

    const fixed = bulkFixFile(content);

    if (fixed !== content) {
      fs.writeFileSync(filepath, fixed);
      return true;
    }

    return false;
  } catch (error) {
    console.error(`Error processing ${filepath}:`, error.message);
    return false;
  }
}

function main() {
  const baseDir = path.join(process.cwd(), 'src');

  try {
    console.log(`Bulk fixing converted test files in ${baseDir}...`);
    const allFiles = findSpecFiles(baseDir);

    let fixed = 0;
    const problemFiles = [];

    for (const filepath of allFiles) {
      if (processFile(filepath)) {
        fixed++;
        console.log(`✓ Fixed ${path.relative(process.cwd(), filepath)}`);
      } else {
        const content = fs.readFileSync(filepath, 'utf8');
        if (content.includes('it.effect(') && hasConversionIssues(content)) {
          problemFiles.push(filepath);
        }
      }
    }

    console.log(`\nBulk fix complete: ${fixed} files fixed`);

    if (problemFiles.length > 0) {
      console.log(`\nFiles still needing manual attention: ${problemFiles.length}`);
      problemFiles.forEach(file => {
        console.log(`  - ${path.relative(process.cwd(), file)}`);
      });
    }

  } catch (error) {
    console.error('Error:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { bulkFixFile, hasConversionIssues };