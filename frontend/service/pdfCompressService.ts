import { upload } from '@vercel/blob/client';

import { ProcessingAbortError, throwIfAborted } from '@/service/processing';

export type CompressionLevel = 'recommended' | 'less';

export interface CompressUploadProgress {
    loaded: number;
    total: number;
    percentage: number;
}

export interface CompressPdfFileOptions {
    file: File;
    level: CompressionLevel;
    signal?: AbortSignal;
    onUploadProgress?: (progress: CompressUploadProgress) => void;
}

export interface CompressPdfFileResult {
    sourceBlobUrl: string;
    sourceDownloadUrl: string;
    outputBlobUrl: string;
    outputDownloadUrl: string;
    outputFilename: string;
    originalSizeBytes: number;
    compressedSizeBytes: number;
    reductionPercent: number;
}

export interface DownloadCompressedPdfBytesOptions {
    url: string;
    signal?: AbortSignal;
}

interface CompressApiResponse {
    level: CompressionLevel;
    originalSizeBytes: number;
    compressedSizeBytes: number;
    reductionPercent: number;
    outputFilename: string;
    compressedBlobUrl: string;
    downloadUrl?: string | null;
}

const CLIENT_UPLOAD_ROUTE = '/api/get-upload-url';
const COMPRESS_API_ROUTE = '/api/compress-pdf';

const sanitizeFilename = (filename: string): string => {
    const baseName = filename.replace(/\\/g, '/').split('/').pop() ?? 'document.pdf';
    const cleaned = baseName.replace(/[^a-zA-Z0-9._-]/g, '_') || 'document.pdf';
    return cleaned.toLowerCase().endsWith('.pdf') ? cleaned : `${cleaned}.pdf`;
};

const buildUploadPathname = (filename: string): string => {
    const safeName = sanitizeFilename(filename);
    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const dd = String(now.getUTCDate()).padStart(2, '0');
    return `compress-inputs/${yyyy}/${mm}/${dd}/${safeName}`;
};

const ensureDownloadUrl = (url: string, downloadUrl?: string | null): string => {
    if (downloadUrl && typeof downloadUrl === 'string')
        return downloadUrl;

    const next = new URL(url);
    next.searchParams.set('download', '1');
    return next.toString();
};

const parseErrorMessage = async (response: Response): Promise<string> => {
    try {
        const data = await response.json() as { detail?: string; error?: string };
        return data.detail || data.error || `Request failed with status ${response.status}`;
    } catch {
        try {
            const text = await response.text();
            return text || `Request failed with status ${response.status}`;
        } catch {
            return `Request failed with status ${response.status}`;
        }
    }
};

const isAbortSignalTriggered = (signal?: AbortSignal): boolean => Boolean(signal?.aborted);

export const compressPdfFile = async ({
    file,
    level,
    signal,
    onUploadProgress,
}: CompressPdfFileOptions): Promise<CompressPdfFileResult> => {
    try {
        throwIfAborted(signal);

        const uploaded = await upload(buildUploadPathname(file.name), file, {
            access: 'public',
            contentType: file.type || 'application/pdf',
            handleUploadUrl: CLIENT_UPLOAD_ROUTE,
            abortSignal: signal,
            multipart: file.size >= 8 * 1024 * 1024,
            clientPayload: JSON.stringify({
                tool: 'compress-pdf',
                originalFilename: file.name,
                sizeBytes: file.size,
            }),
            onUploadProgress,
        });

        throwIfAborted(signal);

        const response = await fetch(COMPRESS_API_ROUTE, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                sourceBlobUrl: uploaded.url,
                level,
                originalFilename: file.name,
            }),
            signal,
        });

        if (!response.ok) {
            const message = await parseErrorMessage(response);
            throw new Error(message);
        }

        const data = await response.json() as CompressApiResponse;
        throwIfAborted(signal);

        return {
            sourceBlobUrl: uploaded.url,
            sourceDownloadUrl: uploaded.downloadUrl,
            outputBlobUrl: data.compressedBlobUrl,
            outputDownloadUrl: ensureDownloadUrl(
                data.compressedBlobUrl,
                data.downloadUrl
            ),
            outputFilename: data.outputFilename,
            originalSizeBytes: data.originalSizeBytes,
            compressedSizeBytes: data.compressedSizeBytes,
            reductionPercent: data.reductionPercent,
        };
    } catch (error) {
        if (isAbortSignalTriggered(signal))
            throw new ProcessingAbortError();
        throw error;
    }
};

export const downloadCompressedPdfBytes = async ({
    url,
    signal,
}: DownloadCompressedPdfBytesOptions): Promise<Uint8Array> => {
    try {
        throwIfAborted(signal);

        const response = await fetch(url, {
            method: 'GET',
            signal,
        });

        if (!response.ok) {
            const message = await parseErrorMessage(response);
            throw new Error(message);
        }

        const bytes = new Uint8Array(await response.arrayBuffer());
        throwIfAborted(signal);
        return bytes;
    } catch (error) {
        if (isAbortSignalTriggered(signal))
            throw new ProcessingAbortError();
        throw error;
    }
};
