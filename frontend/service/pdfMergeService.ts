import { degrees, PDFDocument } from 'pdf-lib';

import { isAbortError, throwIfAborted } from '@/service/processing';
import type { ToolProcessingProgress } from '@/types/toolProcessing';

export interface PdfSourceFile {
    name: string;
    file: File;
    rotation: number;
}

export interface MergeWarning {
    fileName: string;
    message: string;
}

export interface MergePdfOptions {
    files: PdfSourceFile[];
    signal?: AbortSignal;
    onProgress?: (progress: ToolProcessingProgress) => void;
}

export interface MergePdfResult {
    bytes: Uint8Array;
    warnings: MergeWarning[];
}

export const mergePdfFiles = async ({
    files,
    signal,
    onProgress,
}: MergePdfOptions): Promise<MergePdfResult> => {
    throwIfAborted(signal);

    const warnings: MergeWarning[] = [];
    const mergedPdf = await PDFDocument.create();
    const total = files.length;
    let completed = 0;

    for (const fileMeta of files) {
        throwIfAborted(signal);

        try {
            const pdfBytes = await fileMeta.file.arrayBuffer();
            throwIfAborted(signal);

            const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });
            const indices = doc.getPageIndices();
            if (indices.length === 0) {
                warnings.push({
                    fileName: fileMeta.name,
                    message: 'File has no pages and was skipped.',
                });
            } else {
                const copiedPages = await mergedPdf.copyPages(doc, indices);
                copiedPages.forEach((page) => {
                    const originalRotation = page.getRotation().angle;
                    page.setRotation(degrees((originalRotation + fileMeta.rotation) % 360));
                    mergedPdf.addPage(page);
                });
            }
        } catch (error) {
            if (isAbortError(error))
                throw error;

            warnings.push({
                fileName: fileMeta.name,
                message: error instanceof Error
                    ? error.message
                    : 'Error processing file during merge.',
            });
        } finally {
            completed += 1;
            onProgress?.({
                completed,
                total,
                currentFileName: fileMeta.name,
                stage: 'merge',
            });
        }
    }

    throwIfAborted(signal);
    if (mergedPdf.getPageCount() === 0)
        throw new Error('No pages could be added to the merged document. Check input files.');

    const bytes = await mergedPdf.save();
    throwIfAborted(signal);

    return {
        bytes,
        warnings,
    };
};
