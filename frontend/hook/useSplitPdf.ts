'use client';

import {
    useCallback,
    useEffect,
    useRef,
    useState,
    type Dispatch,
    type SetStateAction,
} from 'react';
import toast from 'react-hot-toast';

import { createBlobUrlFromBytes } from '@/lib/blobUrls';
import { useManagedToolResult } from '@/hook/useManagedToolResult';
import type { FileMeta } from '@/hook/fileMeta';
import { isAbortError } from '@/service/processing';
import { splitPdfFiles, type SplitMode } from '@/service/pdfSplitService';
import { createZipBlob } from '@/service/zipService';

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
        progressPercent,
        progressLabel,
        cancelProcessing,
        actionDisabled,
        handleSplitPdf,
    };
}

export type { SplitMode };
