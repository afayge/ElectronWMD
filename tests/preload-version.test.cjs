const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');
const path = require('node:path');

test('compiled preload exposes runtime app version and 1.5.5 changes without device writes', async () => {
    const calls = [];
    let native;
    let ready;
    const completed = new Promise(resolve => ready = resolve);
    const electron = {
        ipcRenderer: { on() {}, invoke: async channel => { calls.push(channel); return channel === 'app:getVersion' ? '9.8.7-runtime' : []; } },
        contextBridge: { exposeInMainWorld: (name, value) => { assert.equal(name, 'native'); native = value; } },
    };
    vm.runInNewContext(fs.readFileSync(path.resolve('dist/preload.js'), 'utf8'), {
        exports: {}, require: name => { assert.equal(name, 'electron'); return electron; },
        console: { log() {}, group() {}, groupEnd() {} }, Event,
        window: { dispatchEvent: event => { assert.equal(event.type, 'ewmd-native-ready'); ready(); } },
    });
    await completed;
    assert.equal(native.appVersion, '9.8.7-runtime');
    assert.deepEqual(Array.from(native.wrapperChangelog[0].entry.contents), [
        'Improved shutdown and restart stability',
        'Added Pinyin and Japanese character conversion for NetMD titles',
    ]);
    assert.equal(native.wrapperChangelog[0].entry.name, 'Version 1.5.5');
    assert.ok(calls.every(channel => channel.endsWith('_definedParameters') || channel === 'app:getVersion'));
});
