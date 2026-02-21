/// <reference lib="webworker" />

// ─── Polyfills (MUST run before pdfjs-dist loads) ────────────────────────────

if (typeof self.OffscreenCanvas === 'undefined') {
    console.warn('OffscreenCanvas not natively supported in this worker environment.');
    (self as any).OffscreenCanvas = class {
        width: number;
        height: number;
        constructor(width: number, height: number) {
            this.width = width;
            this.height = height;
        }
        getContext(_contextId: string): null {
            console.warn("OffscreenCanvas getContext is not polyfilled.");
            return null;
        }
        convertToBlob(): Promise<Blob | null> {
            console.warn("OffscreenCanvas convertToBlob is not polyfilled.");
            return Promise.resolve(null);
        }
    };
}

if (!(self as any).document) {
    const mockElement = {
        style: {},
        remove: () => { },
    };

    const mockBodyOrHead = {
        appendChild: () => mockElement,
        removeChild: () => { },
        style: {},
    };

    (self as any).document = {
        createElement: (tag: string) => {
            if (typeof OffscreenCanvas !== 'undefined' && tag?.toLowerCase() === 'canvas')
                return new OffscreenCanvas(1, 1);
            return mockElement;
        },
        head: mockBodyOrHead,
        body: mockBodyOrHead,
        documentElement: { style: {} },
    };
}

// ─── Lazy-loaded pdfjs (initialized once, after polyfills) ───────────────────

let pdfjsReady: Promise<typeof import('pdfjs-dist')> | null = null;

function getPdfjs(): Promise<typeof import('pdfjs-dist')> {
    if (!pdfjsReady) {
        pdfjsReady = import('pdfjs-dist').then((pdfjs) => {
            const pdfjsVersion = '5.2.133';
            pdfjs.GlobalWorkerOptions.workerSrc =
                `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
            return pdfjs;
        });
    }
    return pdfjsReady;
}

// ─── Message handler ─────────────────────────────────────────────────────────

self.onmessage = async (e: MessageEvent<ArrayBuffer>) => {
    let pdf = null;
    let objectUrl: string | null = null;

    try {
        const buffer = e.data;
        if (!(buffer instanceof ArrayBuffer))
            throw new Error('Preview request payload is invalid.');

        if (typeof OffscreenCanvas === 'undefined')
            throw new Error('OffscreenCanvas is not supported in this worker.');

        const { getDocument } = await getPdfjs();

        pdf = await getDocument({
            data: buffer,
            useSystemFonts: true,
        }).promise;

        if (pdf.numPages === 0)
            throw new Error('PDF has no pages.');

        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 1 });
        const desiredWidth = 140;
        const scale = desiredWidth / viewport.width;
        const scaledViewport = page.getViewport({ scale });

        const canvasWidth = Math.max(1, Math.round(scaledViewport.width));
        const canvasHeight = Math.max(1, Math.round(scaledViewport.height));

        const offscreen = new OffscreenCanvas(canvasWidth, canvasHeight);
        const ctx = offscreen.getContext('2d');

        if (!ctx)
            throw new Error('Failed to get 2D context from OffscreenCanvas.');

        await page.render({
            canvasContext: ctx as unknown as CanvasRenderingContext2D,
            viewport: scaledViewport,
        }).promise;

        page.cleanup();

        const blob = await offscreen.convertToBlob({ type: 'image/webp', quality: 0.8 });
        if (!blob)
            throw new Error('Failed to convert canvas to Blob.');

        objectUrl = URL.createObjectURL(blob);
        postMessage({ success: true, url: objectUrl } satisfies WorkerResponse);

    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error('Error in preview.worker:', errorMsg, err);
        if (objectUrl)
            URL.revokeObjectURL(objectUrl);

        postMessage({ success: false, error: errorMsg } satisfies WorkerResponse);
    } finally {
        pdf?.destroy();
    }
};

self.onerror = (event) => {
    console.error("Unhandled worker error:", event);
};

export { };