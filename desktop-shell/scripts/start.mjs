import { spawn, spawnSync } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const nodeCommand = process.platform === 'win32'
  ? { executable: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', 'npx --yes node@26.8.1 -p process.execPath'] }
  : { executable: 'npx', args: ['--yes', 'node@26.8.1', '-p', 'process.execPath'] }
const nodeResult = spawnSync(nodeCommand.executable, nodeCommand.args, {
  cwd: root,
  encoding: 'utf8',
  windowsHide: true
})

if (nodeResult.status !== 0 || !nodeResult.stdout.trim()) {
  process.stderr.write(nodeResult.stderr || 'Unable to resolve Node 26.8.1 runtime.\n')
  process.exit(nodeResult.status || 1)
}

const electronCli = path.join(root, 'node_modules', 'electron', 'cli.js')
const child = spawn(nodeResult.stdout.trim(), [electronCli, path.join(root, 'dist', 'main.js')], {
  cwd: root,
  stdio: 'inherit',
  windowsHide: false,
  env: {
    ...process.env,
    FARMCLAW_NODE_RUNTIME: nodeResult.stdout.trim()
  }
})

child.once('error', (error) => {
  console.error(error)
  process.exitCode = 1
})
child.once('exit', (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exitCode = code ?? 1
})
