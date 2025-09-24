const fs = require('fs');
const path = require('path');

// Get all .spec.ts files that need fixing
const errorFiles = [
  'src/domain/camera/__test__/ThirdPersonCamera.spec.ts',
  'src/domain/chunk/__test__/ChunkData.spec.ts',
  'src/domain/chunk/__test__/ChunkPosition.spec.ts',
  'src/domain/game-loop/__test__/GameLoopService.spec.ts',
  'src/domain/input/__test__/InputService.spec.ts',
  'src/domain/input/__test__/KeyboardInput.spec.ts',
  'src/domain/input/__test__/MouseSensitivity.spec.ts',
  'src/domain/interaction/__test__/BlockInteractionService.spec.ts',
  'src/domain/inventory/__test__/InventoryService.spec.ts',
  'src/domain/player/__test__/MovementSystem.spec.ts',
  'src/domain/player/__test__/PlayerServiceLive.spec.ts',
  'src/domain/player/__test__/PlayerService.spec.ts',
  'src/domain/player/__test__/Player.spec.ts',
  'src/domain/scene/scenes/__test__/GameScene.spec.ts',
  'src/domain/scene/scenes/__test__/LoadingScene.spec.ts',
  'src/domain/scene/scenes/__test__/MainMenuScene.spec.ts',
  'src/domain/scene/__test__/SceneManagerLive.spec.ts',
  'src/domain/scene/__test__/SceneManager.spec.ts',
  'src/domain/world/__test__/createWorldGenerator.spec.ts',
  'src/infrastructure/ecs/__test__/Entity.spec.ts',
  'src/infrastructure/rendering/__test__/TextureAtlas.spec.ts',
  'src/infrastructure/rendering/__test__/FaceCulling.spec.ts',
  'src/infrastructure/rendering/__test__/AmbientOcclusion.spec.ts',
  'src/infrastructure/rendering/__test__/GreedyMeshing.spec.ts',
  'src/infrastructure/ecs/__test__/SystemRegistry.spec.ts',
  'src/shared/testing/effect-test-utils.ts',
  'src/shared/errors/__test__/ErrorRecovery.spec.ts',
  'src/shared/errors/__test__/GameErrors.spec.ts',
  'src/shared/errors/__test__/NetworkErrors.spec.ts',
  'src/shared/services/__test__/ConfigService.spec.ts',
  'src/shared/services/__test__/LoggerService.spec.ts',
  'src/shared/services/__test__/LoggerServiceLive.spec.ts',
  'src/shared/testing/__test__/effect-test-utils.spec.ts'
];

function fixFile(filePath) {
  const fullPath = path.join('/home/nixos/ts-minecraft', filePath);
  if (!fs.existsSync(fullPath)) {
    console.log(`File not found: ${fullPath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let originalContent = content;

  // Fix "return true" statements
  content = content.replace(/^        return true$/gm, '');

  // Fix malformed Match expressions - add missing Match.when(false) and Match.exhaustive
  content = content.replace(
    /(yield\*\s+pipe\([^,]+,\s*Match\.value,\s*Match\.when\(true,\s*[^}]+}\)\s*)\))/gm,
    '$1,\n            Match.when(false, () => Effect.succeed(undefined)),\n            Match.exhaustive\n          ))'
  );

  // Fix missing commas after forEach/map statements
  content = content.replace(/(\s+}\))\s*(\n\s*}\)\s*$)/gm, '$1,$2');

  // Fix missing parentheses/commas in pipe chains
  content = content.replace(/}\)\s*\n\s*}\)\s*$/gm, '})\n      })\n    )');

  // Fix malformed Exit.match patterns
  content = content.replace(
    /Exit\.match\(([^,]+),\s*{\s*onSuccess:\s*([^}]+)}\s*\)/gm,
    'Exit.match($1, {\n          onSuccess: $2,\n          onFailure: (error) => { /* handle error */ }\n        })'
  );

  // Write back the fixed content
  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`Fixed: ${filePath}`);
  } else {
    console.log(`No changes needed: ${filePath}`);
  }
}

// Process all files
console.log('Starting comprehensive syntax fixes...');
errorFiles.forEach(fixFile);
console.log('Comprehensive syntax fixes completed.');