import * as esbuild from 'esbuild'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

await esbuild.build({
  entryPoints: [path.join(root, 'src/main.ts')],
  outfile: path.join(root, 'dist/main.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node26',
  external: ['electron', '@deepseek-ai/dsh'],
  sourcemap: true,
  banner: {
    js: "import { createRequire as __farmclawCreateRequire } from 'node:module'; const require = __farmclawCreateRequire(import.meta.url);"
  }
})

await esbuild.build({
  entryPoints: [path.join(root, 'src/preload.ts')],
  outfile: path.join(root, 'dist/preload.cjs'),
  bundle: true,
  platform: 'node',
  format: 'cjs',
  target: 'node26',
  external: ['electron'],
  sourcemap: true
})
