import { DOMParser, XMLSerializer } from '@xmldom/xmldom';
export interface LabelPdfRequest {
    pages: string[];
    paperSize: { width: number; height: number };
}
const tags = new Set([
    'svg',
    'g',
    'defs',
    'clipPath',
    'mask',
    'path',
    'rect',
    'ellipse',
    'circle',
    'line',
    'polyline',
    'polygon',
    'pattern',
    'image',
    'use',
]);
const attributes = new Set([
    'xmlns',
    'xmlns:xlink',
    'width',
    'height',
    'viewBox',
    'x',
    'y',
    'cx',
    'cy',
    'r',
    'rx',
    'ry',
    'x1',
    'x2',
    'y1',
    'y2',
    'd',
    'points',
    'fill',
    'stroke',
    'stroke-width',
    'stroke-linecap',
    'stroke-linejoin',
    'stroke-dasharray',
    'stroke-miterlimit',
    'fill-rule',
    'clip-rule',
    'opacity',
    'fill-opacity',
    'stroke-opacity',
    'transform',
    'id',
    'clip-path',
    'mask',
    'maskUnits',
    'maskContentUnits',
    'patternUnits',
    'patternTransform',
    'preserveAspectRatio',
    'href',
    'xlink:href',
]);
export function validateLabelPdfRequest(value: unknown): LabelPdfRequest {
    const r = value as LabelPdfRequest;
    if (!r || !Array.isArray(r.pages) || !r.pages.length || r.pages.length > 100 || !r.paperSize)
        throw new Error('Invalid label PDF request');
    if (![r.paperSize.width, r.paperSize.height].every((v) => typeof v === 'number' && Number.isFinite(v) && v >= 10 && v <= 2000))
        throw new Error('Invalid paper dimensions');
    let length = 0;
    const pages = r.pages.map((source) => {
        if (typeof source !== 'string' || (length += source.length) > 128 * 1024 * 1024 || /<!DOCTYPE|<!ENTITY/i.test(source))
            throw new Error('Invalid SVG size or declaration');
        const doc = new DOMParser({
            onError: () => {
                throw new Error('Malformed label SVG');
            },
        }).parseFromString(source, 'image/svg+xml');
        if (doc.documentElement?.localName !== 'svg') throw new Error('Expected SVG');
        let nodes = 0;
        const ids = new Set<string>();
        const imageIds = new Set<string>();
        const imageReferences: string[] = [];
        const walk = (el: any) => {
            if (++nodes > 400000 || !tags.has(el.localName) || el.namespaceURI !== 'http://www.w3.org/2000/svg')
                throw new Error('Unsupported SVG element');
            for (let i = 0; i < el.attributes.length; i++) {
                const a = el.attributes.item(i);
                const v = a.value;
                if (!attributes.has(a.name)) throw new Error('Unsupported SVG attribute');
                if (a.name === 'id') {
                    if (ids.has(v)) throw new Error('Duplicate SVG ID');
                    ids.add(v);
                    if (el.localName === 'image') imageIds.add(v);
                }
                if (a.name === 'href' || a.name === 'xlink:href') {
                    if (el.localName === 'use') {
                        if (!/^#[\w-]+$/.test(v)) throw new Error('Only internal image reuse is allowed');
                        imageReferences.push(v.slice(1));
                    } else if (!/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(v))
                        throw new Error('Only embedded raster images are allowed');
                } else if (a.name !== 'xmlns' && a.name !== 'xmlns:xlink') {
                    if (/(?:javascript:|https?:|file:|data:|@import)/i.test(v) || (/url\(/i.test(v) && !/^url\(#[\w-]+\)$/.test(v)))
                        throw new Error('External SVG resource');
                }
            }
            for (let child = el.firstChild; child; child = child.nextSibling) {
                if (child.nodeType === 1) walk(child);
                else if (child.nodeType !== 3 && child.nodeType !== 8) throw new Error('Unsupported SVG node');
            }
        };
        walk(doc.documentElement);
        if (imageReferences.some(id => !imageIds.has(id))) throw new Error('SVG reuse must reference an embedded image');
        return new XMLSerializer().serializeToString(doc.documentElement);
    });
    return { pages, paperSize: { ...r.paperSize } };
}
