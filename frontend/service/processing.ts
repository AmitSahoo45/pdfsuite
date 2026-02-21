export class ProcessingAbortError extends Error {
    constructor(message = 'Processing was cancelled.') {
        super(message);
        this.name = 'AbortError';
    }
}

export const throwIfAborted = (signal?: AbortSignal) => {
    if (signal?.aborted)
        throw new ProcessingAbortError();
};

export const isAbortError = (error: unknown): boolean =>
    error instanceof Error && error.name === 'AbortError';
