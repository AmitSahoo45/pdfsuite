import { degrees, PDFDocument } from 'pdf-lib';

import {
    buildFixedPageGroups,
    expandRangesToPageIndices,
    getPdfBaseName,
    parsePageRanges,
} from '@/lib/splitUtils';
import { isAbortError, throwIfAborted } from '@/service/processing';
import type { ToolProcessingProgress } from '@/types/toolProcessing';

import type { PdfSourceFile } from './pdfMergeService';

export type SplitMode = 'range' | 'extract-all' | 'extract-selected' | 'fixed';

export interface SplitWarning {
    fileName: string;
    message: string;
}

export interface SplitOutputFile {
    filename: string;
    bytes: Uint8Array;
    mimeType: 'application/pdf';
}

export interface SplitPdfOptions {
    files: PdfSourceFile[];
    mode: SplitMode;
    rangeInput: string;
    selectedPagesInput: string;
    fixedChunkSize: number;
    mergeOutputs: boolean;
    signal?: AbortSignal;
    onProgress?: (progress: ToolProcessingProgress) => void;
}

export interface SplitPdfResult {
    outputs: SplitOutputFile[];
    warnings: SplitWarning[];
}

const addPagesWithRotation = async (
    target: PDFDocument,
    source: PDFDocument,
    indices: number[],
    rotation: number
) => {
    if (indices.length === 0) return;
    const copiedPages = await target.copyPages(source, indices);
    copiedPages.forEach((page) => {
        const originalRotation = page.getRotation().angle;
        page.setRotation(degrees((originalRotation + rotation) % 360));
        target.addPage(page);
    });
};

const createOutputPdf = async (
    sourceDoc: PDFDocument,
    indices: number[],
    rotation: number
): Promise<Uint8Array> => {
    const outDoc = await PDFDocument.create();
    await addPagesWithRotation(outDoc, sourceDoc, indices, rotation);
    return outDoc.save();
};

export const splitPdfFiles = async ({
    files,
    mode,
    rangeInput,
    selectedPagesInput,
    fixedChunkSize,
    mergeOutputs,
    signal,
    onProgress,
}: SplitPdfOptions): Promise<SplitPdfResult> => {
    throwIfAborted(signal);

    const warnings: SplitWarning[] = [];
    const outputs: SplitOutputFile[] = [];
    const total = files.length;
    let completed = 0;

    const mergedDoc = mergeOutputs ? await PDFDocument.create() : null;

    for (let fileIndex = 0; fileIndex < files.length; fileIndex++) {
        throwIfAborted(signal);

        const fileMeta = files[fileIndex];
        try {
            const sourceBytes = await fileMeta.file.arrayBuffer();
            throwIfAborted(signal);

            const sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
            const pageCount = sourceDoc.getPageCount();
            const baseName = getPdfBaseName(fileMeta.name);
            const outputPrefix = files.length > 1
                ? `${fileIndex + 1}_${baseName}`
                : baseName;

            if (pageCount === 0) {
                warnings.push({
                    fileName: fileMeta.name,
                    message: 'File has no pages and was skipped.',
                });
                continue;
            }

            if (mode === 'range') {
                const parsed = parsePageRanges(rangeInput, pageCount);
                if (!parsed.ok) {
                    warnings.push({ fileName: fileMeta.name, message: parsed.error });
                    continue;
                }

                for (const range of parsed.ranges) {
                    throwIfAborted(signal);
                    const indices: number[] = [];
                    for (let page = range.start; page <= range.end; page++) {
                        indices.push(page - 1);
                    }

                    if (mergeOutputs && mergedDoc) {
                        await addPagesWithRotation(mergedDoc, sourceDoc, indices, fileMeta.rotation);
                    } else {
                        outputs.push({
                            filename: `${outputPrefix}_pages_${range.start}-${range.end}.pdf`,
                            bytes: await createOutputPdf(sourceDoc, indices, fileMeta.rotation),
                            mimeType: 'application/pdf',
                        });
                    }
                }
                continue;
            }

            if (mode === 'fixed') {
                const groups = buildFixedPageGroups(pageCount, fixedChunkSize);
                for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
                    throwIfAborted(signal);
                    const group = groups[groupIndex];
                    if (mergeOutputs && mergedDoc) {
                        await addPagesWithRotation(mergedDoc, sourceDoc, group, fileMeta.rotation);
                    } else {
                        outputs.push({
                            filename: `${outputPrefix}_part_${groupIndex + 1}.pdf`,
                            bytes: await createOutputPdf(sourceDoc, group, fileMeta.rotation),
                            mimeType: 'application/pdf',
                        });
                    }
                }
                continue;
            }

            if (mode === 'extract-all') {
                for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
                    throwIfAborted(signal);
                    const indices = [pageIndex];
                    if (mergeOutputs && mergedDoc) {
                        await addPagesWithRotation(mergedDoc, sourceDoc, indices, fileMeta.rotation);
                    } else {
                        outputs.push({
                            filename: `${outputPrefix}_page_${pageIndex + 1}.pdf`,
                            bytes: await createOutputPdf(sourceDoc, indices, fileMeta.rotation),
                            mimeType: 'application/pdf',
                        });
                    }
                }
                continue;
            }

            const parsed = parsePageRanges(selectedPagesInput, pageCount);
            if (!parsed.ok) {
                warnings.push({ fileName: fileMeta.name, message: parsed.error });
                continue;
            }

            const selectedIndices = expandRangesToPageIndices(parsed.ranges, { dedupe: true });
            if (selectedIndices.length === 0) {
                warnings.push({ fileName: fileMeta.name, message: 'No pages selected.' });
                continue;
            }

            if (mergeOutputs && mergedDoc) {
                await addPagesWithRotation(mergedDoc, sourceDoc, selectedIndices, fileMeta.rotation);
            } else {
                for (const index of selectedIndices) {
                    throwIfAborted(signal);
                    outputs.push({
                        filename: `${outputPrefix}_page_${index + 1}.pdf`,
                        bytes: await createOutputPdf(sourceDoc, [index], fileMeta.rotation),
                        mimeType: 'application/pdf',
                    });
                }
            }
        } catch (error) {
            if (isAbortError(error))
                throw error;

            warnings.push({
                fileName: fileMeta.name,
                message: error instanceof Error
                    ? error.message
                    : 'Error processing file during split.',
            });
        } finally {
            completed += 1;
            onProgress?.({
                completed,
                total,
                currentFileName: fileMeta.name,
                stage: 'split',
            });
        }
    }

    throwIfAborted(signal);

    if (mergeOutputs && mergedDoc) {
        if (mergedDoc.getPageCount() > 0) {
            outputs.push({
                filename: 'split_output.pdf',
                bytes: await mergedDoc.save(),
                mimeType: 'application/pdf',
            });
        }
    }

    if (outputs.length === 0)
        throw new Error('No output files were generated. Check your split settings.');

    return {
        outputs,
        warnings,
    };
};
