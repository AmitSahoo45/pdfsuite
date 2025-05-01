/// <reference lib="webworker" />

// Polyfill for OffscreenCanvas as some browser might need it explicitly
if (typeof self.OffscreenCanvas === 'undefined') {
    console.log('OffscreenCanvas not natively supported in this worker environment.');
    (self as any).OffscreenCanvas = class {
        width: number;
        height: number;
        constructor(width: number, height: number) {
            this.width = width;
            this.height = height;
        }
        getContext(_contextId: string): null {
            console.log("OffscreenCanvas getContext is not polyfilled.");
            return null;
        }
        convertToBlob(): Promise<Blob | null> {
            console.log("OffscreenCanvas convertToBlob is not polyfilled.");
            return Promise.resolve(null);
        }
    };
}


if (!(self as any).document) {
    (self as any).document = {
        createElement: (_: string) => {
            if (typeof OffscreenCanvas !== 'undefined')
                return new OffscreenCanvas(1, 1);

            console.log("Cannot create OffscreenCanvas for document stub.");
            return null;
        },
    };
}


import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

const pdfjsVersion = '5.2.133';
GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

const fallbackImageUrl = '/assets/placeholder-preview.svg';

self.onmessage = async (e: MessageEvent<ArrayBuffer>) => {
    let pdf = null;
    let objectUrl: string | null = null;

    try {
        if (typeof OffscreenCanvas === 'undefined')
            throw new Error('OffscreenCanvas is not supported in this worker.');

        pdf = await getDocument({ data: e.data }).promise;
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

        await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport: scaledViewport }).promise;

        const blob = await offscreen.convertToBlob({ type: 'image/webp', quality: 0.8 });
        if (!blob)
            throw new Error('Failed to convert canvas to Blob.');

        objectUrl = URL.createObjectURL(blob);
        postMessage({ success: true, url: objectUrl });

    } catch (err) {
        console.log('Error in preview.worker error:', err);
        if (objectUrl)
            URL.revokeObjectURL(objectUrl);

        postMessage({ success: false, error: (err instanceof Error ? err.message : String(err)), url: fallbackImageUrl });
    } finally {
        pdf?.destroy();
    }
};

self.onerror = (event) => {
    console.log("Unhandled worker error:", event);
    postMessage({ success: false, error: 'Unhandled worker error', url: fallbackImageUrl });
};

export { };