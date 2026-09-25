const { test } = require('node:test');
const assert = require('node:assert/strict');
const { allowLocalFonts } = require('../dist/local-font-permission');
test('local fonts require owned main window and local application page', () => {
    assert.equal(allowLocalFonts(1, 1, 'sandbox://app/index.html'), true);
    for (const [id, url, main] of [[2, 'sandbox://app/index.html', true], [1, 'https://example.com/index.html', true], [1, 'sandbox://app/other.html', true], [1, 'sandbox://app/index.html', false], [undefined, 'sandbox://app/index.html', true]]) {
        assert.equal(allowLocalFonts(id, 1, url, main), false);
    }
});
