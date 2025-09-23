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

function convertItToEffect(content) {
  // Skip if already converted
  if (content.includes('it.effect(')) {
    return content;
  }

  // More robust regex to handle multiline it() tests
  let result = content;

  // Handle simple single-line it() tests
  result = result.replace(
    /(\s*)it\(([^,]+),\s*\(\)\s*=>\s*\{([^}]+)\}\)/g,
    (match, indent, testName, testBody) => {
      const cleanBody = testBody.trim();
      const indentedBody = cleanBody.split('\n').map(line =>
        line.trim() ? '      ' + line.trim() : line
      ).join('\n');

      return `${indent}it.effect(${testName}, () =>
${indent}  Effect.gen(function* () {
      ${indentedBody}
${indent}  })
${indent})`;
    }
  );

  // Handle more complex multiline it() tests
  const lines = result.split('\n');
  const newLines = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    // Check if this line starts an it() test
    const itMatch = line.match(/^(\s*)it\(([^,]+),\s*\(\)\s*=>\s*\{(.*)$/);

    if (itMatch && !line.includes('it.effect(')) {
      const indent = itMatch[1];
      const testName = itMatch[2];
      const firstLineContent = itMatch[3];

      // Collect the test body
      let testBody = '';
      let braceCount = 1; // We already have one opening brace
      let j = i + 1;

      if (firstLineContent.trim()) {
        testBody += '\n      ' + firstLineContent.trim();
      }

      // Count braces to find the end of the test
      while (j < lines.length && braceCount > 0) {
        const bodyLine = lines[j];
        testBody += '\n';

        if (bodyLine.trim()) {
          testBody += '      ' + bodyLine.trim();
        }

        // Count braces (simple approach - may not handle strings perfectly)
        for (const char of bodyLine) {
          if (char === '{') braceCount++;
          if (char === '}') braceCount--;
        }

        j++;
      }

      // Remove the last closing brace from testBody
      testBody = testBody.replace(/\s*}\s*$/, '');

      // Create the new it.effect() format
      newLines.push(`${indent}it.effect(${testName}, () =>`);
      newLines.push(`${indent}  Effect.gen(function* () {${testBody}`);
      newLines.push(`${indent}  })`);
      newLines.push(`${indent})`);

      i = j; // Skip processed lines
    } else {
      newLines.push(line);
      i++;
    }
  }

  result = newLines.join('\n');

  // Fix imports
  result = fixImports(result);

  return result;
}

function fixImports(content) {
  if (!content.includes('it.effect(')) {
    return content;
  }

  const lines = content.split('\n');
  const newLines = [];
  let vitestImportFound = false;
  let effectVitestImportFound = false;
  let effectImportFound = false;

  for (const line of lines) {
    // Handle vitest imports
    if (line.match(/import\s*\{[^}]*\}\s*from\s*['"]vitest['"]/)) {
      vitestImportFound = true;
      // Remove 'it' from vitest imports, keep describe, expect
      let fixedLine = line.replace(/\bit\s*,?\s*/g, '');
      fixedLine = fixedLine.replace(/,\s*,/g, ',');
      fixedLine = fixedLine.replace(/\{\s*,/g, '{');
      fixedLine = fixedLine.replace(/,\s*\}/g, '}');
      newLines.push(fixedLine);

      // Add @effect/vitest import right after
      if (!effectVitestImportFound) {
        newLines.push("import { it } from '@effect/vitest'");
        effectVitestImportFound = true;
      }
    }
    // Handle existing effect imports
    else if (line.match(/import\s*\{[^}]*\}\s*from\s*['"]effect['"]/)) {
      effectImportFound = true;
      // Ensure Effect is in the import
      if (!line.includes('Effect')) {
        const fixedLine = line.replace('}', ', Effect}');
        newLines.push(fixedLine);
      } else {
        newLines.push(line);
      }
    } else {
      newLines.push(line);
    }
  }

  // Add missing imports if needed
  if (!vitestImportFound && content.includes('describe(')) {
    newLines.unshift("import { describe, expect } from 'vitest'");
  }

  if (!effectVitestImportFound && content.includes('it.effect(')) {
    const insertPos = newLines.findIndex(line => line.includes("from 'vitest'")) + 1;
    if (insertPos > 0) {
      newLines.splice(insertPos, 0, "import { it } from '@effect/vitest'");
    } else {
      newLines.unshift("import { it } from '@effect/vitest'");
    }
  }

  if (!effectImportFound && content.includes('Effect.gen')) {
    const insertPos = newLines.findIndex(line => line.includes("@effect/vitest")) + 1;
    if (insertPos > 0) {
      newLines.splice(insertPos, 0, "import { Effect } from 'effect'");
    } else {
      const vitestPos = newLines.findIndex(line => line.includes("from 'vitest'"));
      if (vitestPos >= 0) {
        newLines.splice(vitestPos + 2, 0, "import { Effect } from 'effect'");
      } else {
        newLines.unshift("import { Effect } from 'effect'");
      }
    }
  }

  return newLines.join('\n');
}

function processFile(filepath) {
  try {
    const content = fs.readFileSync(filepath, 'utf8');

    // Skip if no it() tests or already converted
    if (!content.includes('it(') || content.includes('it.effect(')) {
      return false;
    }

    const converted = convertItToEffect(content);

    // Only write if content changed
    if (converted !== content) {
      fs.writeFileSync(filepath, converted);
      return true;
    }
  } catch (error) {
    console.error(`Error processing ${filepath}:`, error.message);
    return false;
  }

  return false;
}

function main() {
  const baseDir = path.join(process.cwd(), 'src');

  try {
    console.log(`Searching for .spec.ts files in ${baseDir}...`);
    const allFiles = findSpecFiles(baseDir);

    // Filter files that need conversion
    const filesToProcess = [];
    for (const filepath of allFiles) {
      try {
        const content = fs.readFileSync(filepath, 'utf8');
        if (content.includes('it(') && !content.includes('it.effect(')) {
          filesToProcess.push(filepath);
        }
      } catch (error) {
        // Skip files we can't read
        continue;
      }
    }

    let converted = 0;
    console.log(`Processing ${filesToProcess.length} files that need conversion...`);

    for (const filepath of filesToProcess) {
      if (processFile(filepath)) {
        converted++;
        console.log(`✓ Converted ${path.relative(process.cwd(), filepath)}`);
      } else {
        console.log(`- Skipped ${path.relative(process.cwd(), filepath)}`);
      }
    }

    console.log(`\nConversion complete: ${converted}/${filesToProcess.length} files converted`);

  } catch (error) {
    console.error('Error:', error.message);
  }
}

if (require.main === module) {
  main();
}

module.exports = { convertItToEffect, fixImports };