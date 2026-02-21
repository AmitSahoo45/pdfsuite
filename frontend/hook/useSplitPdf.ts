'use client';

import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    type Dispatch,
    type SetStateAction,
} from 'react';
import toast from 'react-hot-toast';

import { createBlobUrlFromBytes } from '@/lib/blobUrls';
import {
    buildFixedPageGroups,
    expandRangesToPageIndices,
    getPdfBaseName,
    parsePageRanges,
} from '@/lib/splitUtils';
import { summarizeToolResult } from '@/lib/toolSummary';
import { useManagedToolResult } from '@/hook/useManagedToolResult';
import type { FileMeta } from '@/hook/fileMeta';
import { isAbortError } from '@/service/processing';
import { splitPdfFiles, type SplitMode } from '@/service/pdfSplitService';
import { createZipBlob } from '@/service/zipService';
import type { ToolSummary } from '@/types/toolResult';

interface UseSplitPdfOptions {
    pdfFiles: FileMeta[];
    setIsLoading: Dispatch<SetStateAction<boolean>>;
}

const getModeLabel = (mode: SplitMode): string => {
    if (mode === 'range') return 'Split by range';
    if (mode === 'extract-all') return 'Extract all pages';
    if (mode === 'extract-selected') return 'Extract selected pages';
    return 'Split every N pages';
};

const MAX_SUMMARY_NAMES = 20;

const expandRange = (start: number, end: number): number[] => {
    const indices: number[] = [];
    for (let page = start; page <= end; page++) {
        indices.push(page - 1);
    }
    return indices;
};

const createSplitPlannedSummary = ({
    pdfFiles,
    splitMode,
    rangeInput,
    selectedPagesInput,
    fixedChunkSize,
    mergeOutputs,
}: {
    pdfFiles: FileMeta[];
    splitMode: SplitMode;
    rangeInput: string;
    selectedPagesInput: string;
    fixedChunkSize: number;
    mergeOutputs: boolean;
}): ToolSummary | null => {
    if (pdfFiles.length === 0)
        return null;

    const outputNames: string[] = [];
    let hiddenOutputNameCount = 0;
    let totalOutputCount = 0;
    let estimatedTotalSize = 0;
    let hasAnySelectedPages = false;
    let invalidInputFiles = 0;

    const pushOutputName = (name: string) => {
        if (outputNames.length < MAX_SUMMARY_NAMES) {
            outputNames.push(name);
            return;
        }
        hiddenOutputNameCount += 1;
    };

    pdfFiles.forEach((file, fileIndex) => {
        const pageCount = file.pages;
        if (pageCount < 1)
            return;

        const sourceBaseName = getPdfBaseName(file.name);
        const outputPrefix = pdfFiles.length > 1
            ? `${fileIndex + 1}_${sourceBaseName}`
            : sourceBaseName;

        let pageGroups: number[][] = [];

        if (splitMode === 'range') {
            const parsed = parsePageRanges(rangeInput, pageCount);
            if (!parsed.ok) {
                invalidInputFiles += 1;
                return;
            }
            pageGroups = parsed.ranges.map((range) => expandRange(range.start, range.end));
            if (!mergeOutputs) {
                parsed.ranges.forEach((range) => {
                    pushOutputName(`${outputPrefix}_pages_${range.start}-${range.end}.pdf`);
                });
            }
        } else if (splitMode === 'fixed') {
            pageGroups = buildFixedPageGroups(pageCount, fixedChunkSize);
            if (pageGroups.length === 0) {
                invalidInputFiles += 1;
                return;
            }
            if (!mergeOutputs) {
                pageGroups.forEach((_, groupIndex) => {
                    pushOutputName(`${outputPrefix}_part_${groupIndex + 1}.pdf`);
                });
            }
        } else if (splitMode === 'extract-all') {
            pageGroups = Array.from({ length: pageCount }, (_, pageIndex) => [pageIndex]);
            if (!mergeOutputs) {
                pageGroups.forEach(([pageIndex]) => {
                    pushOutputName(`${outputPrefix}_page_${pageIndex + 1}.pdf`);
                });
            }
        } else {
            const parsed = parsePageRanges(selectedPagesInput, pageCount);
            if (!parsed.ok) {
                invalidInputFiles += 1;
                return;
            }
            const indices = expandRangesToPageIndices(parsed.ranges, { dedupe: true });
            if (indices.length === 0)
                return;

            pageGroups = mergeOutputs ? [indices] : indices.map((index) => [index]);
            if (!mergeOutputs) {
                indices.forEach((index) => {
                    pushOutputName(`${outputPrefix}_page_${index + 1}.pdf`);
                });
            }
        }

        const selectedPageCount = pageGroups.reduce((sum, group) => sum + group.length, 0);
        if (selectedPageCount <= 0)
            return;

        hasAnySelectedPages = true;
        estimatedTotalSize += Math.round(file.size * (selectedPageCount / pageCount));
        totalOutputCount += mergeOutputs ? 0 : pageGroups.length;
    });

    if (mergeOutputs) {
        totalOutputCount = hasAnySelectedPages ? 1 : 0;
        if (hasAnySelectedPages)
            outputNames.push('split_output.pdf');
    }

    let note: string | undefined;
    if (!hasAnySelectedPages) {
        note = 'No outputs would be generated with the current split settings.';
    } else if (invalidInputFiles > 0) {
        note = 'Current settings do not apply to all files. Estimated output may differ.';
    } else {
        note = 'Estimated size is based on selected page count and may differ in output.';
    }

    return {
        phase: 'planned',
        modeLabel: getModeLabel(splitMode),
        outputCount: totalOutputCount,
        outputNames,
        hiddenOutputNameCount,
        totalSizeBytes: hasAnySelectedPages ? estimatedTotalSize : null,
        isEstimatedSize: true,
        zipAvailable: !mergeOutputs && totalOutputCount > 1,
        zipName: !mergeOutputs && totalOutputCount > 1 ? 'split_output.zip' : undefined,
        note,
    };
};

export function useSplitPdf({ pdfFiles, setIsLoading }: UseSplitPdfOptions) {
    const { result, setResult, clearResult } = useManagedToolResult();
    const [splitMode, setSplitMode] = useState<SplitMode>('range');
    const [rangeInput, setRangeInput] = useState('1-2');
    const [selectedPagesInput, setSelectedPagesInput] = useState('1');
    const [fixedChunkSize, setFixedChunkSize] = useState(2);
    const [mergeOutputs, setMergeOutputs] = useState(false);
    const [progressPercent, setProgressPercent] = useState(0);
    const [progressLabel, setProgressLabel] = useState('Idle');
    const abortControllerRef = useRef<AbortController | null>(null);

    const cancelProcessing = useCallback(() => {
        abortControllerRef.current?.abort();
    }, []);

    useEffect(() => {
        return () => {
            abortControllerRef.current?.abort();
            abortControllerRef.current = null;
        };
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

        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        setProgressPercent(0);
        setProgressLabel('Preparing split...');
        clearResult();

        try {
            const splitResult = await splitPdfFiles({
                files: pdfFiles,
                mode: splitMode,
                rangeInput,
                selectedPagesInput,
                fixedChunkSize,
                mergeOutputs,
                signal: controller.signal,
                onProgress: ({ completed, total, currentFileName }) => {
                    if (abortControllerRef.current !== controller) return;
                    const nextProgress = total > 0
                        ? Math.min(100, Math.round((completed / total) * 100))
                        : 0;
                    setProgressPercent(nextProgress);
                    setProgressLabel(currentFileName
                        ? `Splitting ${currentFileName}`
                        : 'Splitting PDFs...');
                },
            });

            if (abortControllerRef.current !== controller) return;

            splitResult.warnings.forEach((warning) => {
                toast.error(`${warning.fileName}: ${warning.message}`);
            });

            const modeLabel = getModeLabel(splitMode);
            if (splitResult.outputs.length === 1) {
                const output = splitResult.outputs[0];
                const blobInfo = createBlobUrlFromBytes(output.bytes, output.mimeType);
                setResult({
                    kind: 'single',
                    modeLabel,
                    file: {
                        url: blobInfo.url,
                        filename: output.filename,
                        mimeType: output.mimeType,
                        sizeBytes: blobInfo.sizeBytes,
                    },
                });
            } else {
                const files = splitResult.outputs.map((output) => {
                    const blobInfo = createBlobUrlFromBytes(output.bytes, output.mimeType);
                    return {
                        url: blobInfo.url,
                        filename: output.filename,
                        mimeType: output.mimeType,
                        sizeBytes: blobInfo.sizeBytes,
                    };
                });

                const zipBlob = createZipBlob(
                    splitResult.outputs.map((output) => ({
                        filename: output.filename,
                        data: output.bytes,
                    }))
                );
                const zipUrl = URL.createObjectURL(zipBlob);

                setResult({
                    kind: 'multi',
                    modeLabel,
                    files,
                    zipFile: {
                        url: zipUrl,
                        filename: 'split_output.zip',
                        mimeType: 'application/zip',
                        sizeBytes: zipBlob.size,
                    },
                });
            }

            setProgressPercent(100);
            setProgressLabel('Split completed');
            toast.success('PDF split completed.');
        } catch (error) {
            if (isAbortError(error)) {
                if (abortControllerRef.current === controller)
                    toast('Split cancelled.');
                return;
            }

            console.error('Error splitting PDFs:', error);
            toast.error(`Split failed: ${error instanceof Error ? error.message : String(error)}`);
            setResult(null);
        } finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
                setIsLoading(false);
            }
        }
    }, [
        clearResult,
        fixedChunkSize,
        mergeOutputs,
        pdfFiles,
        rangeInput,
        selectedPagesInput,
        setIsLoading,
        setResult,
        splitMode,
    ]);

    const actionDisabled =
        pdfFiles.length < 1 ||
        (splitMode === 'fixed' && (!Number.isFinite(fixedChunkSize) || fixedChunkSize < 1));

    const summary = useMemo<ToolSummary | null>(() => {
        if (result)
            return summarizeToolResult(result);

        return createSplitPlannedSummary({
            pdfFiles,
            splitMode,
            rangeInput,
            selectedPagesInput,
            fixedChunkSize,
            mergeOutputs,
        });
    }, [
        fixedChunkSize,
        mergeOutputs,
        pdfFiles,
        rangeInput,
        result,
        selectedPagesInput,
        splitMode,
    ]);

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
        result,
        summary,
        progressPercent,
        progressLabel,
        cancelProcessing,
        actionDisabled,
        handleSplitPdf,
    };
}

export type { SplitMode };
