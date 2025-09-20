import './style.css'

const app = document.querySelector<HTMLDivElement>('#app')

if (!app) {
  throw new Error('App element not found')
}

app.innerHTML = `
  <div>
    <h1>TypeScript Minecraft Clone</h1>
    <p>Vite + TypeScript project initialized successfully!</p>
  </div>
`
