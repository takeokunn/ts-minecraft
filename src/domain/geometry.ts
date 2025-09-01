type Vec3 = [number, number, number];
type Vec2 = [number, number];

export const vertices: Vec3[] = [
  [-0.5, -0.5, 0.5],
  [0.5, -0.5, 0.5],
  [0.5, 0.5, 0.5],
  [-0.5, 0.5, 0.5],
  [-0.5, -0.5, -0.5],
  [0.5, -0.5, -0.5],
  [0.5, 0.5, -0.5],
  [-0.5, 0.5, -0.5],
];

type Face = {
  vertices: [number, number, number, number];
  normal: Vec3;
};

export const faces: Record<string, Face> = {
  east: { vertices: [1, 5, 6, 2], normal: [1, 0, 0] },
  west: { vertices: [4, 0, 3, 7], normal: [-1, 0, 0] },
  top: { vertices: [3, 2, 6, 7], normal: [0, 1, 0] },
  bottom: { vertices: [4, 5, 1, 0], normal: [0, -1, 0] },
  north: { vertices: [0, 1, 2, 3], normal: [0, 0, 1] },
  south: { vertices: [5, 4, 7, 6], normal: [0, 0, -1] },
};

export const faceUvs: Vec2[] = [
  [0, 0],
  [1, 0],
  [1, 1],
  [0, 1],
];

export const faceIndices: number[] = [0, 1, 2, 0, 2, 3];