// Always rebuild BOTH renderer and Electron entrypoints before packaging MD Studio.
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const root = path.resolve(__dirname, '..');
function run(args, cwd = root, env = {}) {
    const result = spawnSync(process.platform === 'win32' ? 'npm.cmd' : 'npm', args, { cwd, env: { ...process.env, ...env }, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) process.exit(result.status || 1);
}
run(['run', 'build'], path.join(root, 'webminidisc'), { PUBLIC_URL: 'sandbox://app/' });
run(['run', 'build:main']);
const version = require(path.join(root, 'package.json')).version;
const preload = fs.readFileSync(path.join(root, 'dist/preload.js'), 'utf8');
if (!preload.includes('Version 1.5.5') || !preload.includes('app:getVersion')) throw new Error('Preload build lacks the current version bridge or changelog');
const renderer = path.join(root, 'renderer');
const staged = path.join(root, 'renderer.labels-next');
fs.rmSync(staged, { recursive: true, force: true });
fs.cpSync(path.join(root, 'webminidisc/dist'), staged, { recursive: true });
const html = fs.readFileSync(path.join(staged, 'index.html'), 'utf8');
if (html.includes('Version 1.5.4')) throw new Error('Renderer still contains a stale application title');
const assets = fs.readdirSync(path.join(staged, 'assets'));
const index = assets.filter(f => /^index-.*\.js$/.test(f)).map(f => fs.readFileSync(path.join(staged, 'assets', f), 'utf8')).join('\n');
if (!index.includes('To Pinyin') || !index.includes('To JIS')) throw new Error('Title conversion controls missing from renderer');
fs.rmSync(renderer, { recursive: true, force: true });
fs.renameSync(staged, renderer);
console.log(`Verified fresh ElectronWMD ${version} renderer, main and preload. Ready to package.`);
