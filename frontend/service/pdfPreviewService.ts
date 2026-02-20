let worker: Worker | null = null;
let isWorkerBusy = false;
let activeRequest: PreviewRequest | null = null;
const requestQueue: PreviewRequest[] = [];
export const FALLBACK_PREVIEW_URL = '/assets/placeholder-preview.svg';

const releaseBlobUrl = (url?: string) => {
    if (url?.startsWith('blob:'))
        URL.revokeObjectURL(url);
};

const terminateWorker = () => {
    if (!worker) return;
    worker.terminate();
    worker = null;
};

const rejectActiveRequest = (reason: unknown) => {
    if (!activeRequest) return;
    activeRequest.reject(reason);
    activeRequest = null;
};

const getWorker = (): Worker => {
    if (!worker) {
        worker = new Worker(new URL('../worker/preview.worker.ts', import.meta.url), { type: 'module' });

        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            const response = event.data;

            if (!activeRequest) {
                console.warn('Worker response received without an active request.');
                releaseBlobUrl(response.url);
                return;
            }

            const completedRequest = activeRequest;
            activeRequest = null;
            isWorkerBusy = false;

            if (response.success && response.url)
                completedRequest.resolve(response.url);
            else
                completedRequest.resolve(FALLBACK_PREVIEW_URL);

            processQueue();
        };

        worker.onerror = (error) => {
            console.error('Unhandled preview worker error:', error);
            if (activeRequest) {
                activeRequest.resolve(FALLBACK_PREVIEW_URL);
                activeRequest = null;
            }
            isWorkerBusy = false;
            terminateWorker();
            processQueue();
        };
    }

    return worker;
};

const processQueue = () => {
    if (isWorkerBusy || requestQueue.length === 0)
        return;

    const nextRequest = requestQueue.shift();
    if (!nextRequest) return;

    isWorkerBusy = true;
    activeRequest = nextRequest;

    nextRequest.file.arrayBuffer()
        .then((buffer) => {
            const workerInstance = getWorker();
            workerInstance.postMessage(buffer, [buffer]);
        })
        .catch((error) => {
            console.error('Error reading file for preview:', error);
            if (activeRequest) {
                activeRequest.resolve(FALLBACK_PREVIEW_URL);
                activeRequest = null;
            }
            isWorkerBusy = false;
            processQueue();
        });
};

/**
 * Generates a preview image URL for the first page of a PDF file.
 * Uses a shared Web Worker to offload the processing.
 */
export const generatePdfPreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        requestQueue.push({
            file,
            resolve,
            reject,
        });
        processQueue();
    });
};

export const cleanupPdfPreviewWorker = () => {
    terminateWorker();
    isWorkerBusy = false;
    rejectActiveRequest(new Error('Preview generation cancelled.'));

    while (requestQueue.length > 0) {
        const req = requestQueue.shift();
        req?.reject(new Error('Preview generation cancelled.'));
    }
};
