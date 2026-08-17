/**
 * Mineradio DSH client plugin build script — no tsdown/monorepo required.
 *
 * Produces from `src/`:
 *   lib/client.js     — browser half: a `window.__ModuleLoader__.load({id, factory})`
 *                        IIFE. The DSH client runtime packages + React are external
 *                        (provided by the host via the factory's `require`); the
 *                        `.module.css` files become hashed-class maps plus one
 *                        <style data-plugin-css> injection each.
 *   lib/index.js       — host half (empty apply, ESM).
 *   lib/invariant.js   — invariant companion (ESM).
 *
 * The client bundle shape (a CommonJS module-registry body wrapped in a
 * factory that closes over `module`/`exports`/`require`) is semantically
 * equivalent to what the monorepo tsdown preset emits, so dsh loads it the
 * same way.
 */
import { build } from 'esbuild'
import { createHash } from 'node:crypto'
import { basename, dirname, join, relative, sep } from 'node:path'
import { readFileSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = dirname(__dirname)
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const PLUGIN_ID = pkg.name

function hash(s) { return createHash('md5').update(s).digest('hex').slice(0, 8) }
function minifyCss(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\s+/g, ' ')
    .replace(/\s*([{}:;,])\s*/g, '$1')
    .trim()
}

/** esbuild plugin: `*.module.css` → hashed class map + <style> injection. */
const cssModules = {
  name: 'dsh-css-modules',
  setup(buildCtx) {
    buildCtx.onResolve({ filter: /\.module\.css$/ }, (args) => {
      return { path: join(dirname(args.importer), args.path), namespace: 'dshcss' }
    })
    buildCtx.onLoad({ filter: /.*/, namespace: 'dshcss' }, (args) => {
      const source = readFileSync(args.path, 'utf8')
      const rel = relative(root, args.path).split(sep).join('/')
      const prefix = basename(args.path, '.module.css').replace(/[^a-zA-Z0-9_]/g, '_')
      const tagId = `${PLUGIN_ID}/${rel}?v=${hash(rel)}`

      // Collect class-defining selectors (`.foo`, excluding pseudo-classes).
      const names = new Set()
      for (const m of source.matchAll(/\.([_a-zA-Z][\w-]*)/g)) {
        if (!/^(:{1,2}[a-z]|hover|active|focus|before|after|not|is|where|has|nth|first|last|child|empty|root)[\w-]*$/i.test(m[1])) {
          names.add(m[1])
        }
      }
      const map = {}
      let out = source
      for (const cls of names) {
        const hashed = `${prefix}_${cls}`
        map[cls] = hashed
        out = out.replace(new RegExp(`\\.${cls}(?![\\w-])`, 'g'), `.${hashed}`)
      }
      const css = minifyCss(out)
      const js = `
if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(${JSON.stringify(tagId)}) + "]") === null) {
  const tag = document.createElement("style");
  tag.dataset.plugin = ${JSON.stringify(PLUGIN_ID)};
  tag.dataset.pluginCss = ${JSON.stringify(tagId)};
  tag.textContent = ${JSON.stringify(css)};
  document.head.appendChild(tag);
}
export default ${JSON.stringify(map)};
`
      return { contents: js, loader: 'js', resolveDir: dirname(args.path) }
    })
  },
}

/** Externalize DSH runtime + React: keep real `require()` calls at runtime. */
const externalize = {
  name: 'dsh-externalize',
  setup(buildCtx) {
    buildCtx.onResolve({ filter: /^(@deepseek-ai\/.*|react$|react\/jsx-runtime)$/ }, (args) => {
      return { path: args.path, external: true }
    })
  },
}

async function main() {
  mkdirSync(join(root, 'lib'), { recursive: true })

  // 1) Browser half: CJS registry body (all dsh/react deps external).
  await build({
    absWorkingDir: root,
    entryPoints: ['src/client/index.ts'],
    bundle: true,
    format: 'cjs',
    platform: 'browser',
    target: 'es2020',
    jsx: 'automatic',
    plugins: [cssModules, externalize],
    define: { 'process.env.NODE_ENV': '"production"' },
    outfile: join(root, 'lib', '.client-core.js'),
  })

  // 2) Wrap the CJS body in a `__ModuleLoader__.load` factory.
  const core = readFileSync(join(root, 'lib', '.client-core.js'), 'utf8')
  const wrapped = `window.__ModuleLoader__.load({
  id: ${JSON.stringify(PLUGIN_ID)},
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
${core}
    return module.exports;
  }
});
`
  writeFileSync(join(root, 'lib', 'client.js'), wrapped)
  rmSync(join(root, 'lib', '.client-core.js'))

  // 3) Host half + invariant companion (ESM, node).
  for (const [src, out] of [['src/index.ts', 'index.js'], ['src/invariant.ts', 'invariant.js']]) {
    await build({
      absWorkingDir: root,
      entryPoints: [src],
      bundle: true,
      format: 'esm',
      platform: 'node',
      target: 'es2020',
      plugins: [externalize],
      define: { 'process.env.NODE_ENV': '"production"' },
      outfile: join(root, 'lib', out),
    })
  }

  console.log('built lib/client.js, lib/index.js, lib/invariant.js')
}

main().catch((err) => { console.error(err); process.exit(1) })
