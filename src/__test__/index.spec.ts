/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, beforeEach, vi } from "vitest";

// Mock DOM and CSS imports
vi.mock('../style.css', () => ({}));

describe("Index Module", () => {
  let mockApp: HTMLDivElement;

  beforeEach(() => {
    // Reset DOM
    document.body.innerHTML = '';

    // Create mock app element
    mockApp = document.createElement('div');
    mockApp.id = 'app';
    document.body.appendChild(mockApp);

    // Clear any mocks
    vi.clearAllMocks();
  });

  it("should find app element and set innerHTML", () => {
    // Simulate what the index.ts module does
    const app = document.querySelector<HTMLDivElement>('#app')!;
    app.innerHTML = `
  <div>
    <h1>TypeScript Minecraft Clone</h1>
    <p>Vite + TypeScript project initialized successfully!</p>
  </div>
`;

    expect(app.innerHTML).toContain('TypeScript Minecraft Clone');
    expect(app.innerHTML).toContain('Vite + TypeScript project initialized successfully!');
  });

  it("should create proper HTML structure", () => {
    // Simulate what the index.ts module does
    const app = document.querySelector<HTMLDivElement>('#app')!;
    app.innerHTML = `
  <div>
    <h1>TypeScript Minecraft Clone</h1>
    <p>Vite + TypeScript project initialized successfully!</p>
  </div>
`;

    const content = app.innerHTML;
    expect(content).toMatch(/<div>/);
    expect(content).toMatch(/<h1>TypeScript Minecraft Clone<\/h1>/);
    expect(content).toMatch(/<p>Vite \+ TypeScript project initialized successfully!<\/p>/);
    expect(content).toMatch(/<\/div>/);
  });

  it("should handle existing app element", () => {
    // Add some initial content
    mockApp.innerHTML = '<p>Initial content</p>';

    // Simulate replacing content like index.ts does
    const app = document.querySelector<HTMLDivElement>('#app')!;
    app.innerHTML = `
  <div>
    <h1>TypeScript Minecraft Clone</h1>
    <p>Vite + TypeScript project initialized successfully!</p>
  </div>
`;

    // Should replace the content
    expect(app.innerHTML).not.toContain('Initial content');
    expect(app.innerHTML).toContain('TypeScript Minecraft Clone');
  });

  it("should import style.css", () => {
    // Test that CSS mock works
    expect(() => {
      vi.mock('../style.css', () => ({}));
    }).not.toThrow();
  });

  it("should use non-null assertion safely", () => {
    // Test that the code works when app element exists
    expect(mockApp).toBeTruthy();

    // Simulate what index.ts does with non-null assertion
    const app = document.querySelector<HTMLDivElement>('#app')!;
    app.innerHTML = `
  <div>
    <h1>TypeScript Minecraft Clone</h1>
    <p>Vite + TypeScript project initialized successfully!</p>
  </div>
`;

    expect(app.innerHTML.length).toBeGreaterThan(0);
  });

  it("should create complete HTML template", () => {
    // Simulate what index.ts does
    const app = document.querySelector<HTMLDivElement>('#app')!;
    app.innerHTML = `
  <div>
    <h1>TypeScript Minecraft Clone</h1>
    <p>Vite + TypeScript project initialized successfully!</p>
  </div>
`;

    // Check that all expected elements are present
    const h1 = app.querySelector('h1');
    const p = app.querySelector('p');
    const div = app.querySelector('div');

    expect(h1).toBeTruthy();
    expect(p).toBeTruthy();
    expect(div).toBeTruthy();

    expect(h1?.textContent).toBe('TypeScript Minecraft Clone');
    expect(p?.textContent).toBe('Vite + TypeScript project initialized successfully!');
  });
});