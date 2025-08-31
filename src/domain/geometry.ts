
// Defines the geometry for a standard 1x1x1 cube.
// Vertices are defined in a way that allows for easy face culling
// and texture mapping.

// 8 vertices of the cube
export const vertices = [
  // Front face
  [-0.5, -0.5, 0.5], // 0
  [0.5, -0.5, 0.5], // 1
  [0.5, 0.5, 0.5], // 2
  [-0.5, 0.5, 0.5], // 3
  // Back face
  [-0.5, -0.5, -0.5], // 4
  [0.5, -0.5, -0.5], // 5
  [0.5, 0.5, -0.5], // 6
  [-0.5, 0.5, -0.5], // 7
];

// 6 faces of the cube, defined by the vertex indices
export const faces = {
  // Each face is defined by 4 vertex indices and a normal vector.
  // The order of vertices is important for correct winding (counter-clockwise).
  // [vertex_indices, normal_vector]
  // Positive X face (right)
  px: {
    vertices: [1, 5, 6, 2],
    normal: [1, 0, 0],
  },
  // Negative X face (left)
  nx: {
    vertices: [4, 0, 3, 7],
    normal: [-1, 0, 0],
  },
  // Positive Y face (top)
  py: {
    vertices: [3, 2, 6, 7],
    normal: [0, 1, 0],
  },
  // Negative Y face (bottom)
  ny: {
    vertices: [4, 5, 1, 0],
    normal: [0, -1, 0],
  },
  // Positive Z face (front)
  pz: {
    vertices: [0, 1, 2, 3],
    normal: [0, 0, 1],
  },
  // Negative Z face (back)
  nz: {
    vertices: [5, 4, 7, 6],
    normal: [0, 0, -1],
  },
};

// Standard UV coordinates for a single face
export const uvs = [
  [0, 0], // Corresponds to vertex 0 of a face
  [1, 0], // Corresponds to vertex 1 of a face
  [1, 1], // Corresponds to vertex 2 of a face
  [0, 1], // Corresponds to vertex 3 of a face
];

// Indices to form two triangles from the 4 vertices of a face
// 0, 1, 2 forms the first triangle
// 0, 2, 3 forms the second triangle
export const indices = [0, 1, 2, 0, 2, 3];
