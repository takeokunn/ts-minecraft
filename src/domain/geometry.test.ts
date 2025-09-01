import { describe, it, expect } from 'vitest';
import { vertices, faces, faceUvs, faceIndices } from './geometry';

describe('domain/geometry', () => {
  it('should have 8 vertices', () => {
    expect(vertices.length).toBe(8);
  });

  it('should have 6 faces', () => {
    expect(Object.keys(faces).length).toBe(6);
  });

  it('should have 4 UV coordinates', () => {
    expect(faceUvs.length).toBe(4);
  });

  it('should have 6 face indices', () => {
    expect(faceIndices.length).toBe(6);
  });

  it('face vertices should be valid indices for vertices array', () => {
    for (const face of Object.values(faces)) {
      for (const vertexIndex of face.vertices) {
        expect(vertexIndex).toBeGreaterThanOrEqual(0);
        expect(vertexIndex).toBeLessThan(vertices.length);
      }
    }
  });
});
