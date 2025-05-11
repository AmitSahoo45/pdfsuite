let worker: Worker | null = null;
let isWorkerBusy = false;
const requestQueue: PreviewRequest[] = [];

const getWorker = (): Worker => {
    if (!worker) {
        worker = new Worker(new URL('../worker/preview.worker.ts', import.meta.url), { type: 'module', /*name: 'pdf-preview-worker' << ---- Todo: re-visit doc  */ });

        worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
            isWorkerBusy = false;
            const response = event.data;
            const processedRequest = requestQueue.shift();

            if (processedRequest) {
                if (response.success)
                    processedRequest.resolve(response.url);
                else
                    processedRequest.reject(new Error(response.error || 'Preview worker failed'));
            } else {
                console.warn("Worker message received but no matching request found in queue.");

                if (response.success && response.url.startsWith('blob:'))
                    URL.revokeObjectURL(response.url);
            }

            processQueue();
        };

        worker.onerror = (error) => {
            console.error('Unhandled Preview Worker error:', error);
            isWorkerBusy = false;
            const processedRequest = requestQueue.shift();

            if (processedRequest) {
                // processedRequest.reject(error); << ----- Todo: check with reject
                // processedRequest.resolve('/assets/placeholder-preview.svg'); // old code
                processedRequest.reject(error);
            }

            worker?.terminate();
            worker = null;
            isWorkerBusy = false;

            while (requestQueue.length > 0) {
                const req = requestQueue.shift();
                req?.resolve('/assets/placeholder-preview.svg'); // Resolve pending with fallback
                // req?.reject(new Error("Worker failed during processing.")); <<< Todo: check with reject
            }
        };
    }
    return worker;
};


const processQueue = () => {
    if (isWorkerBusy || requestQueue.length === 0)
        return;

    isWorkerBusy = true;
    const request = requestQueue[0];

    request.file.arrayBuffer()
        .then(buffer => {
            const workerInstance = getWorker();
            workerInstance.postMessage(buffer, [buffer]);
        })
        .catch(error => {
            console.error("Error reading file for preview:", error);
            isWorkerBusy = false;
            const failedRequest = requestQueue.shift();
            failedRequest?.resolve('/assets/placeholder-preview.svg');
            // failedRequest?.reject(error);
            processQueue(); // Try next request
        });
};

/**
 * Generates a preview image URL for the first page of a PDF file.
 * Uses a shared Web Worker to offload the processing.
 * @param file The PDF file object.
 * @returns A Promise that resolves with the preview image URL (a blob URL or a fallback URL).
 */
export const generatePdfPreview = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        requestQueue.push({ file, resolve, reject });

        if (!isWorkerBusy)
            processQueue();
    });
};

// Todo : Is it required to have a cleanup function? Review required.
export const cleanupPdfPreviewWorker = () => {
    if (worker) {
        console.log('Terminating Preview Worker...');
        worker.terminate();
        worker = null;
        isWorkerBusy = false;
        requestQueue.length = 0;
    }
};