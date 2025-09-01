import { describe, it, expect, vi } from 'vitest';
import { renderScene } from './render';
import type { ThreeContext } from '@/domain/types';

describe('infrastructure/renderer-three/render', () => {
  it('should call stats.begin, renderer.render, and stats.end in order', () => {
    const mockContext: ThreeContext = {
      renderer: {
        render: vi.fn(),
      },
      scene: {},
      camera: {
        camera: {},
      },
      stats: {
        begin: vi.fn(),
        end: vi.fn(),
      },
    } as any;

    renderScene(mockContext);

    const statsBeginOrder = (mockContext.stats.begin as vi.Mock).mock.invocationCallOrder[0];
    const rendererRenderOrder = (mockContext.renderer.render as vi.Mock).mock.invocationCallOrder[0];
    const statsEndOrder = (mockContext.stats.end as vi.Mock).mock.invocationCallOrder[0];

    expect(mockContext.stats.begin).toHaveBeenCalled();
    expect(mockContext.renderer.render).toHaveBeenCalledWith(mockContext.scene, mockContext.camera.camera);
    expect(mockContext.stats.end).toHaveBeenCalled();

    expect(statsBeginOrder).toBeLessThan(rendererRenderOrder);
    expect(rendererRenderOrder).toBeLessThan(statsEndOrder);
  });
});