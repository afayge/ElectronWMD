/** Local font bytes are only available to the application's own top-level page. */
export function allowLocalFonts(requesterId: number | undefined, ownerId: number, pageURL: string, isMainFrame = true): boolean {
    if (requesterId !== ownerId || !isMainFrame) return false;
    try {
        const url = new URL(pageURL);
        return url.protocol === 'sandbox:' && url.hostname === 'app' && url.pathname === '/index.html';
    } catch { return false; }
}
