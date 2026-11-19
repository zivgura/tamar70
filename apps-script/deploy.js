// Builds the bundle, pushes it with clasp, then points the web app's fixed deployment at the
// new code, so the API URL never changes. Run by CI on merges to main; needs clasp credentials
// in ~/.clasprc.json.
//
// Until deployment.json has a webAppDeploymentId (created once by hand in the Apps Script
// editor), it only pushes.
import { spawnSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildBundle } from './build.js'

const here = dirname(fileURLToPath(import.meta.url))
const { webAppDeploymentId } = JSON.parse(readFileSync(join(here, 'deployment.json'), 'utf8'))

function clasp(...args) {
  const res = spawnSync('npx', ['--no-install', 'clasp', ...args], { cwd: here, stdio: 'inherit' })
  if (res.status !== 0) {
    console.error(`clasp ${args[0]} failed (exit ${res.status})`)
    process.exit(res.status || 1)
  }
}

await buildBundle()
clasp('push', '--force')

if (!webAppDeploymentId) {
  console.log(
    'Pushed. No webAppDeploymentId in deployment.json yet, so the web app was not updated.',
  )
  process.exit(0)
}

const sha = (process.env.GITHUB_SHA || 'local').slice(0, 7)
clasp('create-deployment', '--deploymentId', webAppDeploymentId, '--description', `main ${sha}`)
console.log(`Web app deployment ${webAppDeploymentId} now runs ${sha}.`)
