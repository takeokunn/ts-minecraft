import type { ThreeContext } from './context';

export function renderScene(context: ThreeContext): void {
  const { renderer, scene, camera, stats } = context;

  stats.begin();
  renderer.render(scene, camera.camera);
  stats.end();
}
