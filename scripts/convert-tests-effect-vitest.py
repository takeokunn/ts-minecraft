#!/usr/bin/env python3
"""
Convert it() tests to it.effect() format using @effect/vitest pattern for TypeScript Minecraft Clone project
"""

import os
import re
import glob

def convert_it_to_effect(content):
    """Convert it() tests to it.effect() format with proper @effect/vitest imports"""

    # Skip if already converted
    if 'it.effect(' in content:
        return content

    # Pattern to match it('...', () => { ... }) including multiline function bodies
    def replace_it_test(match):
        indent = match.group(1)
        test_name = match.group(2)
        arrow_part = match.group(3)  # ' => {'
        test_body = match.group(4)

        # Clean up test body - remove extra whitespace but preserve structure
        lines = test_body.strip().split('\n')
        indented_lines = []

        for line in lines:
            if line.strip():  # Non-empty lines get proper indentation
                # Add 2 extra spaces for Effect.gen function body
                indented_lines.append('      ' + line.lstrip())
            else:
                indented_lines.append('')

        indented_body = '\n'.join(indented_lines)

        return f"""{indent}it.effect({test_name},{arrow_part.replace('=>', '=>\n' + indent + '  Effect.gen(function* () {')}
{indented_body}
{indent}  }})
{indent})"""

    # Pattern to match it('test name', () => { ... }) with proper multiline handling
    it_pattern = r"(\s*)it\(([^,]+),\s*(\(\)\s*=>\s*\{)([^}]*(?:\{[^}]*\}[^}]*)*)\}"

    # First pass - handle simple single-block it tests
    content = re.sub(it_pattern, replace_it_test, content, flags=re.DOTALL)

    # Handle more complex nested braces (property-based tests, etc.)
    def replace_complex_it(match):
        indent = match.group(1)
        test_name = match.group(2)
        full_body = match.group(3)

        # Add proper indentation to the body
        lines = full_body.split('\n')
        indented_lines = []

        for line in lines:
            if line.strip():
                indented_lines.append('      ' + line.lstrip())
            else:
                indented_lines.append('')

        indented_body = '\n'.join(indented_lines)

        return f"""{indent}it.effect({test_name}, () =>
{indent}  Effect.gen(function* () {{
{indented_body}
{indent}  }})
{indent})"""

    # Handle remaining it() patterns that might have been missed
    remaining_it_pattern = r"(\s*)it\(([^,]+),\s*\(\)\s*=>\s*\{(.*?)\n(\s*)\}\)"
    content = re.sub(remaining_it_pattern, replace_complex_it, content, flags=re.DOTALL)

    # Fix import statements
    content = fix_imports(content)

    return content

def fix_imports(content):
    """Fix import statements to use @effect/vitest pattern"""

    # Check if we need to modify imports (only if we have it.effect in content)
    if 'it.effect(' not in content:
        return content

    lines = content.split('\n')
    new_lines = []
    vitest_import_found = False
    effect_vitest_import_found = False
    effect_import_found = False

    for i, line in enumerate(lines):
        # Handle vitest imports
        if re.match(r"import\s*\{[^}]*\}\s*from\s*['\"]vitest['\"]", line):
            vitest_import_found = True
            # Remove 'it' from vitest imports if present, keep describe, expect
            line = re.sub(r'\bit\s*,?\s*', '', line)
            line = re.sub(r',\s*,', ',', line)  # Clean up double commas
            line = re.sub(r'\{\s*,', '{', line)  # Clean up leading comma
            line = re.sub(r',\s*\}', '}', line)  # Clean up trailing comma
            new_lines.append(line)

            # Add @effect/vitest import right after
            if not effect_vitest_import_found:
                new_lines.append("import { it } from '@effect/vitest'")
                effect_vitest_import_found = True

        # Handle existing effect imports
        elif re.match(r"import\s*\{[^}]*\}\s*from\s*['\"]effect['\"]", line):
            effect_import_found = True
            # Ensure Effect is in the import
            if ', Effect' not in line and 'Effect' not in line:
                line = line.replace('}', ', Effect}')
            new_lines.append(line)

        else:
            new_lines.append(line)

    # Add missing imports if needed
    if not vitest_import_found and 'describe(' in content:
        new_lines.insert(0, "import { describe, expect } from 'vitest'")

    if not effect_vitest_import_found and 'it.effect(' in content:
        insert_pos = 1 if not vitest_import_found else 2
        new_lines.insert(insert_pos, "import { it } from '@effect/vitest'")

    if not effect_import_found and 'Effect.gen' in content:
        insert_pos = 2 if effect_vitest_import_found else 1
        new_lines.insert(insert_pos, "import { Effect } from 'effect'")

    return '\n'.join(new_lines)

def process_file(filepath):
    """Process a single test file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Skip if no it() tests or already converted
        if 'it(' not in content or 'it.effect(' in content:
            return False

        converted = convert_it_to_effect(content)

        # Only write if content changed
        if converted != content:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(converted)
            return True

    except Exception as e:
        print(f"Error processing {filepath}: {e}")
        return False

    return False

def main():
    """Main conversion function"""
    base_dir = "/home/nixos/ts-minecraft/src"
    pattern = "**/*.spec.ts"

    files = glob.glob(os.path.join(base_dir, pattern), recursive=True)

    # Filter out files that don't need conversion
    files_to_process = []
    for filepath in files:
        try:
            with open(filepath, 'r') as f:
                content = f.read()
                if 'it(' in content and 'it.effect(' not in content:
                    files_to_process.append(filepath)
        except:
            continue

    converted_count = 0
    total_files = len(files_to_process)

    print(f"Processing {total_files} files that need conversion...")

    for filepath in files_to_process:
        if process_file(filepath):
            converted_count += 1
            print(f"✓ Converted {filepath}")
        else:
            print(f"- Skipped {filepath}")

    print(f"\nConversion complete: {converted_count}/{total_files} files converted")

if __name__ == "__main__":
    main()