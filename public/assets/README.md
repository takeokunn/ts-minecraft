# Assets Directory

This directory contains all game assets for the TypeScript Minecraft Clone.

## Structure

```
assets/
├── textures/     # Block and entity textures (166 files)
│   └── blocks/   # Block textures including ores, wood, plants
├── sounds/       # Audio files (34 files)
│   ├── blocks/   # Block interaction sounds
│   ├── ambient/  # Environmental sounds
│   ├── entity/   # Entity sounds
│   ├── music/    # Background music
│   ├── ui/       # User interface sounds
│   └── misc/     # Miscellaneous sounds
└── manifest.json # Complete asset inventory and license information
```

## License Information

All assets are licensed under **CC0 1.0 Universal (Public Domain)** or are generated placeholders.

For detailed license information, sources, and attributions, see `manifest.json`.

## Quick Stats

- **Textures**: 166 files
- **Sounds**: 34 files
- **License**: CC0 (No attribution required)
- **Sources**: OpenGameArt.org, Freesound.org, Generated

## Usage

Assets are automatically loaded via the manifest.json file. The AssetManager service handles all asset loading and caching.

```typescript
// Assets are accessed through the manifest
import manifest from './public/assets/manifest.json';
```

## Contributing

When adding new assets:
1. Place files in appropriate directories
2. Run `python3 create_asset_manifest.py` to update manifest
3. Ensure all assets are CC0 or appropriately licensed
4. Update this README if structure changes significantly
