import type { ToolResult, ToolResultFile } from '@/types/toolResult';

export const revokeBlobUrl = (url?: string | null) => {
    if (url?.startsWith('blob:'))
        URL.revokeObjectURL(url);
};

export const createBlobUrlFromBytes = (
    bytes: Uint8Array,
    mimeType: string
): { url: string; sizeBytes: number } => {
    const arrayBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(arrayBuffer).set(bytes);
    const blob = new Blob([arrayBuffer], { type: mimeType });
    return {
        url: URL.createObjectURL(blob),
        sizeBytes: arrayBuffer.byteLength,
    };
};

export const revokeResultFile = (file?: ToolResultFile | null) => {
    if (!file) return;
    revokeBlobUrl(file.url);
};

export const revokeToolResult = (result?: ToolResult | null) => {
    if (!result) return;

    if (result.kind === 'single' || result.kind === 'zip') {
        revokeResultFile(result.file);
        return;
    }

    result.files.forEach((file) => revokeResultFile(file));
    if (result.zipFile)
        revokeResultFile(result.zipFile);
};
