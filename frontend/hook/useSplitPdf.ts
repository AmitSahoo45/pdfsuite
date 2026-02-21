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
import { createZipBlob } from '@/service/zipService';

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

const toBlobUrl = (bytes: Uint8Array, mimeType: string): string => {
    const buffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(buffer).set(bytes);
    const blob = new Blob([buffer], { type: mimeType });
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

type GeneratedOutput = {
    filename: string;
    bytes: Uint8Array;
};

export function useSplitPdf({ pdfFiles, setIsLoading }: UseSplitPdfOptions) {
    const [splitMode, setSplitMode] = useState<SplitMode>('range');
    const [rangeInput, setRangeInput] = useState('1-2');
    const [selectedPagesInput, setSelectedPagesInput] = useState('1');
    const [fixedChunkSize, setFixedChunkSize] = useState(2);
    const [mergeOutputs, setMergeOutputs] = useState(false);
    const [resultFiles, setResultFiles] = useState<SplitResultFile[]>([]);
    const [zipResult, setZipResult] = useState<SplitResultFile | null>(null);

    useEffect(() => {
        return () => {
            revokeResultFiles(resultFiles);
            if (zipResult)
                revokeBlobUrl(zipResult.url);
        };
    }, [resultFiles, zipResult]);

    const clearResultFiles = useCallback(() => {
        setResultFiles((prev) => {
            revokeResultFiles(prev);
            return [];
        });
        setZipResult((prev) => {
            if (prev)
                revokeBlobUrl(prev.url);
            return null;
        });
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

        const generatedOutputs: GeneratedOutput[] = [];
        const mergedDocument = mergeOutputs ? await PDFDocument.create() : null;
        let nextResults: SplitResultFile[] = [];
        let nextZipResult: SplitResultFile | null = null;

        try {
            for (let fileIndex = 0; fileIndex < pdfFiles.length; fileIndex++) {
                const fileMeta = pdfFiles[fileIndex];
                const sourceBytes = await fileMeta.file.arrayBuffer();
                const sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
                const pageCount = sourceDoc.getPageCount();
                const baseName = getPdfBaseName(fileMeta.name);
                const outputPrefix = pdfFiles.length > 1
                    ? `${fileIndex + 1}_${baseName}`
                    : baseName;

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
                            generatedOutputs.push({
                                filename: `${outputPrefix}_pages_${range.start}-${range.end}.pdf`,
                                bytes: await outDoc.save(),
                            });
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
                            generatedOutputs.push({
                                filename: `${outputPrefix}_part_${groupIndex + 1}.pdf`,
                                bytes: await outDoc.save(),
                            });
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
                            generatedOutputs.push({
                                filename: `${outputPrefix}_page_${pageIndex + 1}.pdf`,
                                bytes: await outDoc.save(),
                            });
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
                        generatedOutputs.push({
                            filename: `${outputPrefix}_page_${index + 1}.pdf`,
                            bytes: await outDoc.save(),
                        });
                    }
                }
            }

            if (mergeOutputs && mergedDocument) {
                if (mergedDocument.getPageCount() === 0)
                    throw new Error('No pages matched your split options.');

                const mergedUrl = toBlobUrl(await mergedDocument.save(), 'application/pdf');
                nextResults.push({
                    url: mergedUrl,
                    filename: 'split_output.pdf',
                });
            } else if (generatedOutputs.length === 1) {
                const onlyOutput = generatedOutputs[0];
                nextResults.push({
                    url: toBlobUrl(onlyOutput.bytes, 'application/pdf'),
                    filename: onlyOutput.filename,
                });
            } else if (generatedOutputs.length > 1) {
                nextResults.push(
                    ...generatedOutputs.map((output) => ({
                        url: toBlobUrl(output.bytes, 'application/pdf'),
                        filename: output.filename,
                    }))
                );

                const zipBlob = createZipBlob(
                    generatedOutputs.map((output) => ({
                        filename: output.filename,
                        data: output.bytes,
                    }))
                );
                nextZipResult = {
                    url: URL.createObjectURL(zipBlob),
                    filename: 'split_output.zip',
                };
            }

            if (nextResults.length === 0 && !nextZipResult)
                throw new Error('No output files were generated. Check your split settings.');

            setResultFiles(nextResults);
            setZipResult(nextZipResult);
            toast.success('PDF split completed.');
        } catch (error) {
            revokeResultFiles(nextResults);
            if (nextZipResult)
                revokeBlobUrl(nextZipResult.url);

            console.error('Error splitting PDFs:', error);
            toast.error(`Split failed: ${error instanceof Error ? error.message : String(error)}`);
            nextResults = [];
            nextZipResult = null;
            setResultFiles([]);
            setZipResult(null);
        } finally {
            setIsLoading(false);
        }
    }, [
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
        zipResult,
        resultUrl,
        resultFilename,
        actionDisabled,
        handleSplitPdf,
    };
}
