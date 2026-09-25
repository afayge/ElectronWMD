import { BrowserWindow, ipcMain } from 'electron';
import { validateLabelPdfRequest } from './label-pdf-validation';
import { lifecycle } from './app-shutdown';

export function setupLabelPdf(owner: BrowserWindow) {
    ipcMain.removeHandler('labels:renderPdf');
    let running = false;
    ipcMain.handle('labels:renderPdf', async (event, input: unknown) => {
        if (event.sender !== owner.webContents || !event.senderFrame || event.senderFrame !== owner.webContents.mainFrame)
            throw new Error('Invalid PDF caller');
        if (running) throw new Error('PDF export already running');
        const r = validateLabelPdfRequest(input);
        running = true;
        try {
            return await lifecycle.run('labels:renderPdf', async () => {
                const window = new BrowserWindow({
                    show: false,
                    webPreferences: {
                        sandbox: true,
                        contextIsolation: true,
                        nodeIntegration: false,
                        javascript: false,
                        webSecurity: true,
                        partition: `labels-${Date.now()}`,
                    },
                });
                let timeout: ReturnType<typeof setTimeout> | undefined;
                try {
                    window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
                    window.webContents.session.webRequest.onBeforeRequest((details, callback) =>
                        callback({ cancel: details.url !== 'labelprint://document/' && !details.url.startsWith('data:') })
                    );
                    const html = `<!doctype html><html><head><title>MD 标签与包装</title><meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data:; style-src 'unsafe-inline'"><style>@page{size:${
                        r.paperSize.width
                    }mm ${r.paperSize.height}mm;margin:0}html,body{margin:0;padding:0}section{width:${r.paperSize.width}mm;height:${
                        r.paperSize.height
                    }mm;break-after:page;overflow:hidden}section:last-child{break-after:auto}svg{display:block}</style></head><body>${r.pages
                        .map((svg) => `<section>${svg}</section>`)
                        .join('')}</body></html>`;
                    // Serve the in-memory document from this isolated session. A data: navigation
                    // would exceed Chromium's URL limit for normal photographic cover images.
                    window.webContents.session.protocol.handle('labelprint', (request) =>
                        request.url === 'labelprint://document/'
                            ? new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
                            : new Response('', { status: 404 })
                    );
                    return await Promise.race([
                        (async () => {
                            await window.loadURL('labelprint://document/');
                            return new Uint8Array(
                                await window.webContents.printToPDF({
                                    printBackground: true,
                                    preferCSSPageSize: true,
                                    margins: { top: 0, bottom: 0, left: 0, right: 0 },
                                    scale: 1,
                                })
                            );
                        })(),
                        new Promise<never>((_, reject) => {
                            timeout = setTimeout(() => reject(new Error('PDF export timed out')), 60000);
                        }),
                    ]);
                } finally {
                    if (timeout) clearTimeout(timeout);
                    if (!window.isDestroyed()) {
                        window.webContents.session.protocol.unhandle('labelprint');
                        window.destroy();
                    }
                }
            });
        } finally {
            running = false;
        }
    });
}
