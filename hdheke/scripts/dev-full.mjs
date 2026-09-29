import { spawn } from 'node:child_process'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const apiPort = Number(process.env.PORT ?? 3001)
const apiUrl = `http://127.0.0.1:${apiPort}/api/books-status`
const apiIsRunning = async () => {
  try {
    const response = await fetch(apiUrl, { signal: AbortSignal.timeout(1200) })
    return response.ok
  } catch {
    return false
  }
}

const children = []
if (await apiIsRunning()) {
  console.log(`[dev:full] Reusing the Cresa API already running on port ${apiPort}.`)
} else {
  children.push(spawn(process.execPath, ['server/index.mjs'], { cwd: projectRoot, stdio: 'inherit', env: { ...process.env, PORT: String(apiPort) } }))
}
children.push(spawn(process.execPath, ['node_modules/vite/bin/vite.js'], { cwd: projectRoot, stdio: 'inherit' }))

const stop = () => {
  for (const child of children) {
    if (!child.killed) child.kill()
  }
}

process.on('SIGINT', () => { stop(); process.exit() })
process.on('SIGTERM', () => { stop(); process.exit() })

for (const child of children) {
  child.on('error', error => console.error('[dev:full] Could not start a development process:', error.message))
  child.on('exit', code => {
    if (code && code !== 0) console.error(`[dev:full] A development process exited with code ${code}.`)
  })
}
