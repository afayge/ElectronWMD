const { test } = require('node:test');
const assert = require('node:assert/strict');
const { validateLabelPdfRequest } = require('../dist/label-pdf-validation');
const request = (svg) => ({ pages: [svg], paperSize: { width: 210, height: 297 } });
const wrap = (body) => `<svg xmlns="http://www.w3.org/2000/svg" width="210mm" height="297mm" viewBox="0 0 210 297">${body}</svg>`;
test('PDF input allows paths and local raster images', () => {
    assert.equal(
        validateLabelPdfRequest(request(wrap('<path d="M0 0L1 1"/><image href="data:image/png;base64,AAAA" width="10" height="10"/>')))
            .pages.length,
        1
    );
});
test('PDF input rejects scripts, HTML, files and external images', () => {
    for (const body of [
        '<script>alert(1)</script>',
        '<foreignObject><div>HTML</div></foreignObject>',
        '<image href="https://example.test/image.png"/>',
        '<image href="file:///etc/passwd"/>',
        '<image href="data:image/svg+xml;base64,AAAA"/>',
        '<rect onload="evil()"/>',
        '<rect fill="url(https://example.test)"/>',
    ])
        assert.throws(() => validateLabelPdfRequest(request(wrap(body))));
});
test('PDF input rejects invalid dimensions and external entities', () => {
    assert.throws(() => validateLabelPdfRequest({ ...request(wrap('')), paperSize: { width: -1, height: 297 } }));
    assert.throws(() => validateLabelPdfRequest(request('<!DOCTYPE svg SYSTEM "file:///etc/passwd">' + wrap(''))));
});

test('PDF bleed masks allow only internal references and inert shapes', () => {
    const mask = '<defs><mask id="bleed" maskUnits="userSpaceOnUse" maskContentUnits="userSpaceOnUse" x="-2" y="-2" width="40" height="57"><rect fill="#ffffff" width="40" height="57"/><rect fill="#000000" width="36" height="53"/></mask></defs>';
    assert.equal(validateLabelPdfRequest(request(wrap(mask + '<g mask="url(#bleed)"><rect width="40" height="57"/></g>'))).pages.length, 1);
    for (const body of [
        '<g mask="url(https://example.test/mask.svg#mask)"/>', '<mask onload="evil()"/>',
        '<mask><script>evil()</script></mask>', '<mask><image href="file:///private/image.png"/></mask>',
    ]) assert.throws(() => validateLabelPdfRequest(request(wrap(body))));
});

test('PDF image reuse accepts only embedded raster targets, never external or recursive references', () => {
    const source = '<defs><image id="pixels" href="data:image/png;base64,AAAA" width="10" height="10"/></defs>';
    assert.equal(validateLabelPdfRequest(request(wrap(source + '<use href="#pixels"/>'))).pages.length, 1);
    for (const svg of ['<use href="https://example.test/image.svg#x"/>', '<use id="loop" href="#loop"/>', '<g id="g"><use href="#g"/></g>', '<use href="#missing"/>', source + '<g id="pixels"><use href="#pixels"/></g>'])
        assert.throws(() => validateLabelPdfRequest(request(wrap(svg))));
});
