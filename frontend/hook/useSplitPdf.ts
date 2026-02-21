'use client';

import {
    useCallback,
    useEffect,
    useMemo,
    useState,
    type Dispatch,
    type SetStateAction,
} from 'react';
import { degrees, PDFDocument } from 'pdf-lib';
import toast from 'react-hot-toast';

import type { FileMeta } from '@/hook/fileMeta';
import {
    buildFixedPageGroups,
    expandRangesToPageIndices,
    getPdfBaseName,
    parsePageRanges,
} from '@/lib/splitUtils';

export type SplitMode = 'range' | 'extract-all' | 'extract-selected' | 'fixed';

export type SplitResultFile = {
    url: string;
    filename: string;
};

interface UseSplitPdfOptions {
    pdfFiles: FileMeta[];
    setIsLoading: Dispatch<SetStateAction<boolean>>;
}

const revokeBlobUrl = (url: string) => {
    if (url.startsWith('blob:'))
        URL.revokeObjectURL(url);
};

const revokeResultFiles = (files: SplitResultFile[]) => {
    files.forEach((file) => revokeBlobUrl(file.url));
};

const toPdfBlobUrl = (bytes: Uint8Array<ArrayBufferLike>): string => {
    const blob = new Blob([bytes], { type: 'application/pdf' });
    return URL.createObjectURL(blob);
};

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

export function useSplitPdf({ pdfFiles, setIsLoading }: UseSplitPdfOptions) {
    const [splitMode, setSplitMode] = useState<SplitMode>('range');
    const [rangeInput, setRangeInput] = useState('1-2');
    const [selectedPagesInput, setSelectedPagesInput] = useState('1');
    const [fixedChunkSize, setFixedChunkSize] = useState(2);
    const [mergeOutputs, setMergeOutputs] = useState(false);
    const [resultFiles, setResultFiles] = useState<SplitResultFile[]>([]);

    useEffect(() => {
        return () => {
            revokeResultFiles(resultFiles);
        };
    }, [resultFiles]);

    const clearResultFiles = useCallback(() => {
        setResultFiles((prev) => {
            revokeResultFiles(prev);
            return [];
        });
    }, []);

    const addSingleResultFile = useCallback((url: string, filename: string, sink: SplitResultFile[]) => {
        sink.push({ url, filename });
    }, []);

    const handleSplitPdf = useCallback(async () => {
        if (pdfFiles.length === 0) {
            toast.error('You need at least one PDF file to split.');
            return;
        }

        if (splitMode === 'fixed' && (!Number.isFinite(fixedChunkSize) || fixedChunkSize < 1)) {
            toast.error('Pages per split must be at least 1.');
            return;
        }

        clearResultFiles();
        setIsLoading(true);

        const nextResults: SplitResultFile[] = [];
        const mergedDocument = mergeOutputs ? await PDFDocument.create() : null;

        try {
            for (const fileMeta of pdfFiles) {
                const sourceBytes = await fileMeta.file.arrayBuffer();
                const sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
                const pageCount = sourceDoc.getPageCount();
                const baseName = getPdfBaseName(fileMeta.name);

                if (pageCount === 0) {
                    toast.error(`${fileMeta.name} has no pages. Skipping.`);
                    continue;
                }

                if (splitMode === 'range') {
                    const parsed = parsePageRanges(rangeInput, pageCount);
                    if (!parsed.ok) {
                        toast.error(`${fileMeta.name}: ${parsed.error}`);
                        continue;
                    }

                    for (const range of parsed.ranges) {
                        const indices: number[] = [];
                        for (let page = range.start; page <= range.end; page++) {
                            indices.push(page - 1);
                        }

                        if (mergeOutputs && mergedDocument) {
                            await addPagesWithRotation(mergedDocument, sourceDoc, indices, fileMeta.rotation);
                        } else {
                            const outDoc = await PDFDocument.create();
                            await addPagesWithRotation(outDoc, sourceDoc, indices, fileMeta.rotation);
                            const url = toPdfBlobUrl(await outDoc.save());
                            addSingleResultFile(
                                url,
                                `${baseName}_pages_${range.start}-${range.end}.pdf`,
                                nextResults
                            );
                        }
                    }
                    continue;
                }

                if (splitMode === 'fixed') {
                    const groups = buildFixedPageGroups(pageCount, fixedChunkSize);
                    for (let groupIndex = 0; groupIndex < groups.length; groupIndex++) {
                        const group = groups[groupIndex];
                        if (mergeOutputs && mergedDocument) {
                            await addPagesWithRotation(mergedDocument, sourceDoc, group, fileMeta.rotation);
                        } else {
                            const outDoc = await PDFDocument.create();
                            await addPagesWithRotation(outDoc, sourceDoc, group, fileMeta.rotation);
                            const url = toPdfBlobUrl(await outDoc.save());
                            addSingleResultFile(
                                url,
                                `${baseName}_part_${groupIndex + 1}.pdf`,
                                nextResults
                            );
                        }
                    }
                    continue;
                }

                if (splitMode === 'extract-all') {
                    for (let pageIndex = 0; pageIndex < pageCount; pageIndex++) {
                        const indices = [pageIndex];
                        if (mergeOutputs && mergedDocument) {
                            await addPagesWithRotation(mergedDocument, sourceDoc, indices, fileMeta.rotation);
                        } else {
                            const outDoc = await PDFDocument.create();
                            await addPagesWithRotation(outDoc, sourceDoc, indices, fileMeta.rotation);
                            const url = toPdfBlobUrl(await outDoc.save());
                            addSingleResultFile(
                                url,
                                `${baseName}_page_${pageIndex + 1}.pdf`,
                                nextResults
                            );
                        }
                    }
                    continue;
                }

                const parsed = parsePageRanges(selectedPagesInput, pageCount);
                if (!parsed.ok) {
                    toast.error(`${fileMeta.name}: ${parsed.error}`);
                    continue;
                }

                const selectedIndices = expandRangesToPageIndices(parsed.ranges, { dedupe: true });
                if (selectedIndices.length === 0) {
                    toast.error(`${fileMeta.name}: No pages selected.`);
                    continue;
                }

                if (mergeOutputs && mergedDocument) {
                    await addPagesWithRotation(mergedDocument, sourceDoc, selectedIndices, fileMeta.rotation);
                } else {
                    for (const index of selectedIndices) {
                        const outDoc = await PDFDocument.create();
                        await addPagesWithRotation(outDoc, sourceDoc, [index], fileMeta.rotation);
                        const url = toPdfBlobUrl(await outDoc.save());
                        addSingleResultFile(
                            url,
                            `${baseName}_page_${index + 1}.pdf`,
                            nextResults
                        );
                    }
                }
            }

            if (mergeOutputs && mergedDocument) {
                if (mergedDocument.getPageCount() === 0)
                    throw new Error('No pages matched your split options.');

                const mergedUrl = toPdfBlobUrl(await mergedDocument.save());
                nextResults.push({
                    url: mergedUrl,
                    filename: 'split_output.pdf',
                });
            }

            if (!mergeOutputs && nextResults.length === 0)
                throw new Error('No output files were generated. Check your split settings.');

            setResultFiles(nextResults);
            toast.success('PDF split completed.');
        } catch (error) {
            revokeResultFiles(nextResults);
            console.error('Error splitting PDFs:', error);
            toast.error(`Split failed: ${error instanceof Error ? error.message : String(error)}`);
            setResultFiles([]);
        } finally {
            setIsLoading(false);
        }
    }, [
        addSingleResultFile,
        clearResultFiles,
        fixedChunkSize,
        mergeOutputs,
        pdfFiles,
        rangeInput,
        selectedPagesInput,
        setIsLoading,
        splitMode,
    ]);

    const resultUrl = useMemo(
        () => (resultFiles.length === 1 ? resultFiles[0].url : null),
        [resultFiles]
    );

    const resultFilename = useMemo(
        () => (resultFiles.length === 1 ? resultFiles[0].filename : undefined),
        [resultFiles]
    );

    const actionDisabled =
        pdfFiles.length < 1 ||
        (splitMode === 'fixed' && (!Number.isFinite(fixedChunkSize) || fixedChunkSize < 1));

    return {
        splitMode,
        setSplitMode,
        rangeInput,
        setRangeInput,
        selectedPagesInput,
        setSelectedPagesInput,
        fixedChunkSize,
        setFixedChunkSize,
        mergeOutputs,
        setMergeOutputs,
        resultFiles,
        resultUrl,
        resultFilename,
        actionDisabled,
        handleSplitPdf,
    };
}
