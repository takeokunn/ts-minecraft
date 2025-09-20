#!/usr/bin/env bash

# Wrapper script for oxlint on NixOS
# This script patches the oxlint binary to work with NixOS's dynamic linker

set -e

OXLINT_PATH="node_modules/.pnpm/@oxlint+linux-x64-gnu@1.15.0/node_modules/@oxlint/linux-x64-gnu/oxlint"

if [[ ! -f "$OXLINT_PATH" ]]; then
    echo "oxlint binary not found at $OXLINT_PATH"
    exit 1
fi

# Check if we're on NixOS
if [[ -f /etc/NIXOS ]]; then
    # Use nix-shell to provide the necessary libraries
    exec nix-shell -p glibc --run "$OXLINT_PATH $*"
else
    # Not on NixOS, run directly
    exec "$OXLINT_PATH" "$@"
fi