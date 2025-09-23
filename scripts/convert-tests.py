#!/usr/bin/env python3
"""
Convert it() tests to it.effect() format for TypeScript Minecraft Clone project
"""

import os
import re
import glob

def convert_it_to_effect(content):
    """Convert it() tests to it.effect() format"""

    # Pattern to match it('...', () => { ... })
    pattern = r"(\s*)it\(([^,]+),\s*\(\)\s*=>\s*\{([^}]*(?:\{[^}]*\}[^}]*)*)\}\)"

    def replace_match(match):
        indent = match.group(1)
        test_name = match.group(2)
        test_body = match.group(3)

        # Remove leading/trailing whitespace but preserve internal structure
        test_body = test_body.strip()

        # Indent the test body properly for Effect.gen
        lines = test_body.split('\n')
        indented_body = []
        for line in lines:
            if line.strip():  # Only indent non-empty lines
                indented_body.append('  ' + line)
            else:
                indented_body.append(line)

        indented_body_str = '\n'.join(indented_body)

        return f"""{indent}it.effect({test_name}, () =>
{indent}  Effect.gen(function* () {{
{indented_body_str}
{indent}  }})
{indent})"""

    # Apply the replacement
    result = re.sub(pattern, replace_match, content, flags=re.DOTALL)

    # Add Effect import if not present
    if 'import { Effect' not in result and 'Effect.gen' in result:
        # Find the import line with vitest
        import_pattern = r"(import\s*\{\s*[^}]*)\}\s*from\s*'vitest'"
        vitest_match = re.search(import_pattern, result)
        if vitest_match:
            # Replace vitest import line
            result = re.sub(import_pattern, r"\1} from 'vitest'", result)

        # Find if there's already an effect import
        if 'from \'effect\'' in result:
            # Add Effect to existing effect import
            effect_pattern = r"(import\s*\{\s*[^}]*?)(}\s*from\s*'effect')"
            if ', Effect' not in result:
                result = re.sub(effect_pattern, r'\1, Effect\2', result)
        else:
            # Add new effect import after vitest import
            vitest_line = re.search(r"import.*from\s*'vitest'", result)
            if vitest_line:
                end_pos = vitest_line.end()
                result = result[:end_pos] + "\nimport { Effect } from 'effect'" + result[end_pos:]

    return result

def process_file(filepath):
    """Process a single test file"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()

        # Check if it contains it() tests
        if 'it(' not in content:
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

    converted_count = 0
    total_files = len(files)

    for filepath in files:
        if process_file(filepath):
            converted_count += 1
            print(f"✓ Converted {filepath}")
        else:
            print(f"- Skipped {filepath}")

    print(f"\nConversion complete: {converted_count}/{total_files} files converted")

if __name__ == "__main__":
    main()