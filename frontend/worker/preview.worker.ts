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
    // fix for Failed to load PDF document error : starts here
    const mockElement = {
        style: {},
        remove: () => { console.log("Mock remove called"); }
    };

    const mockBodyOrHead = {
        appendChild: () => mockElement,
        removeChild: () => { },
        style: {},
    };

    (self as any).document = {
        createElement: (_: string) => {
            if (typeof OffscreenCanvas !== 'undefined' && _?.toLocaleLowerCase() === 'canvas') /* <<< fix */
                return new OffscreenCanvas(1, 1);

            console.log("Cannot create OffscreenCanvas for document stub.");
            return null;
        },
        head: mockBodyOrHead,
        body: mockBodyOrHead,
        documentElement: { style: {} }, /* <<<< fix */
    };

    // fix for Failed to load PDF document error : ends here
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

        pdf = await getDocument({ 
            data: e.data,
            useSystemFonts: true /* test fix - RCHK */
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

        await page.render({ canvasContext: ctx as unknown as CanvasRenderingContext2D, viewport: scaledViewport }).promise;

        // Cleaning up page resources <<<<< fix : rchk
        page.cleanup();

        const blob = await offscreen.convertToBlob({ type: 'image/webp', quality: 0.8 });
        if (!blob)
            throw new Error('Failed to convert canvas to Blob.');

        objectUrl = URL.createObjectURL(blob);
        postMessage({ success: true, url: objectUrl });

    } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        console.error(`Error in preview.worker :`, errorMsg, err); 
        if (objectUrl) 
            URL.revokeObjectURL(objectUrl);
        
        postMessage({ success: false, error: errorMsg, url: fallbackImageUrl });
    } finally {
        pdf?.destroy();
    }
};

self.onerror = (event) => {
    console.log("Unhandled worker error:", event);
    postMessage({ success: false, error: 'Unhandled worker error', url: fallbackImageUrl });
};

export { };