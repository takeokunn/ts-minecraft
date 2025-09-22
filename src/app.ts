import './style.css'

export function initApp(): void {
  const app = document.querySelector<HTMLDivElement>('#app')!

  app.innerHTML = `
    <div>
      <h1>TypeScript Minecraft Clone</h1>
      <p>Vite + TypeScript project initialized successfully!</p>
    </div>
  `
}
