/// <reference lib="webworker" />

; (self as any).document = {
    createElement: (_: string) => {
        // note: PDF.js will set width/height later via reset(); this is just a stub.
        return new OffscreenCanvas(1, 1);
    },
};

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

const pdfjsVersion = '5.2.133';
GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;

self.onmessage = async (e: MessageEvent<ArrayBuffer>) => {
    try {
        const pdf = await getDocument({ data: e.data }).promise;
        const page = await pdf.getPage(1);

        const viewport = page.getViewport({ scale: 1 });
        const desiredWidth = 140;
        const scale = desiredWidth / viewport.width;
        const scaled = page.getViewport({ scale });

        const offscreen = new OffscreenCanvas(scaled.width, scaled.height);
        const ctx = offscreen.getContext('2d') as unknown as CanvasRenderingContext2D;
        if (!ctx) throw new Error('OffscreenCanvas 2D context not available');

        await page.render({ canvasContext: ctx, viewport: scaled }).promise;
        pdf.destroy();

        const blob = await offscreen.convertToBlob();
        const url = URL.createObjectURL(blob);
        postMessage(url);

    } catch (err) {
        console.error('preview.worker error:', err);
        postMessage('/assets/placeholder-preview.svg');
    }
};
