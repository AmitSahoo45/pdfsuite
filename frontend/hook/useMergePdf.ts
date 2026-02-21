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
import { summarizeToolResult } from '@/lib/toolSummary';
import { useManagedToolResult } from '@/hook/useManagedToolResult';
import type { FileMeta } from '@/hook/fileMeta';
import { isAbortError } from '@/service/processing';
import { mergePdfFiles } from '@/service/pdfMergeService';
import type { ToolSummary } from '@/types/toolResult';

interface UseMergePdfOptions {
    pdfFiles: FileMeta[];
    setIsLoading: Dispatch<SetStateAction<boolean>>;
}

export function useMergePdf({ pdfFiles, setIsLoading }: UseMergePdfOptions) {
    const { result, setResult, clearResult } = useManagedToolResult();
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

    const handleMergePdfs = useCallback(async () => {
        if (pdfFiles.length < 2) {
            toast.error('You need at least two PDF files to merge.');
            return;
        }

        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        setProgressPercent(0);
        setProgressLabel('Preparing merge...');
        clearResult();

        try {
            const mergeResult = await mergePdfFiles({
                files: pdfFiles,
                signal: controller.signal,
                onProgress: ({ completed, total, currentFileName }) => {
                    if (abortControllerRef.current !== controller) return;
                    const nextProgress = total > 0
                        ? Math.min(100, Math.round((completed / total) * 100))
                        : 0;
                    setProgressPercent(nextProgress);
                    setProgressLabel(currentFileName
                        ? `Merging ${currentFileName}`
                        : 'Merging PDFs...');
                },
            });

            if (abortControllerRef.current !== controller) return;

            mergeResult.warnings.forEach((warning) => {
                toast.error(`Skipping ${warning.fileName}: ${warning.message}`);
            });

            const blobInfo = createBlobUrlFromBytes(mergeResult.bytes, 'application/pdf');
            setResult({
                kind: 'single',
                modeLabel: 'Merge PDF',
                file: {
                    url: blobInfo.url,
                    filename: 'merged_document.pdf',
                    mimeType: 'application/pdf',
                    sizeBytes: blobInfo.sizeBytes,
                },
            });

            setProgressPercent(100);
            setProgressLabel('Merge completed');
            toast.success('PDFs merged successfully!');
        } catch (error) {
            if (isAbortError(error)) {
                if (abortControllerRef.current === controller)
                    toast('Merge cancelled.');
                return;
            }

            console.error('Error merging PDFs:', error);
            toast.error(`Merge failed: ${error instanceof Error ? error.message : String(error)}`);
            setResult(null);
        } finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
                setIsLoading(false);
            }
        }
    }, [clearResult, pdfFiles, setIsLoading, setResult]);

    const summary = useMemo<ToolSummary | null>(() => {
        if (result)
            return summarizeToolResult(result);

        if (pdfFiles.length === 0)
            return null;

        const estimatedSize = pdfFiles.reduce((sum, file) => sum + file.size, 0);
        const outputReady = pdfFiles.length >= 2;

        return {
            phase: 'planned',
            modeLabel: 'Merge PDF',
            outputCount: outputReady ? 1 : 0,
            outputNames: outputReady ? ['merged_document.pdf'] : [],
            totalSizeBytes: outputReady ? estimatedSize : null,
            isEstimatedSize: true,
            zipAvailable: false,
            note: outputReady
                ? 'Estimated size is based on source files and may differ in output.'
                : 'Add at least two PDF files to generate merged output.',
        };
    }, [pdfFiles, result]);

    return {
        result,
        summary,
        progressPercent,
        progressLabel,
        cancelProcessing,
        handleMergePdfs,
    };
}
