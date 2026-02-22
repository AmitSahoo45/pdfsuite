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

import { createCompressCompletedSummary, createCompressPlannedSummary, getCompressionModeLabel, type CompressionSummaryTotals } from '@/lib/compressSummary';
import { useManagedToolResult } from '@/hook/useManagedToolResult';
import type { FileMeta } from '@/hook/fileMeta';
import {
    compressPdfFile,
    downloadCompressedPdfBytes,
    type CompressionLevel,
} from '@/service/pdfCompressService';
import { isAbortError } from '@/service/processing';
import {
    createZipBlob,
    estimateZipSizeBytes,
    ZIP_MEMORY_WARNING_THRESHOLD_BYTES,
} from '@/service/zipService';
import type { ToolResult, ToolResultFile, ToolSummary } from '@/types/toolResult';

interface UseCompressPdfOptions {
    pdfFiles: FileMeta[];
    setIsLoading: Dispatch<SetStateAction<boolean>>;
}

const clampProgress = (value: number): number => Math.max(0, Math.min(100, Math.round(value)));

const progressForUploadStage = (fileIndex: number, totalFiles: number, uploadPercentage: number): number => {
    const fileStart = (fileIndex / totalFiles) * 100;
    const fileWidth = 100 / totalFiles;
    const uploadPortion = Math.max(0, Math.min(100, uploadPercentage)) / 100;
    // Upload consumes the first 55% of each file's progress window.
    return clampProgress(fileStart + (fileWidth * 0.55 * uploadPortion));
};

const progressForCompressStage = (fileIndex: number, totalFiles: number): number => {
    const fileStart = (fileIndex / totalFiles) * 100;
    const fileWidth = 100 / totalFiles;
    // Compression/network processing sits around 75% of the file window before completion.
    return clampProgress(fileStart + (fileWidth * 0.75));
};

interface CompletedCompressedOutput {
    file: ToolResultFile;
    downloadUrl: string;
}

const buildToolResult = ({
    files,
    modeLabel,
    zipFile,
}: {
    files: ToolResultFile[];
    modeLabel: string;
    zipFile?: ToolResultFile;
}): ToolResult => {
    if (files.length === 1) {
        return {
            kind: 'single',
            modeLabel,
            file: files[0],
        };
    }

    return {
        kind: 'multi',
        modeLabel,
        files,
        zipFile,
    };
};

const toErrorMessage = (error: unknown): string =>
    error instanceof Error ? error.message : String(error);

export function useCompressPdf({ pdfFiles, setIsLoading }: UseCompressPdfOptions) {
    const { result, setResult, clearResult } = useManagedToolResult();
    const [compressionLevel, setCompressionLevel] = useState<CompressionLevel>('recommended');
    const [progressPercent, setProgressPercent] = useState(0);
    const [progressLabel, setProgressLabel] = useState('Idle');
    const [summaryTotals, setSummaryTotals] = useState<CompressionSummaryTotals | null>(null);
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

    const handleCompressPdf = useCallback(async () => {
        if (pdfFiles.length === 0) {
            toast.error('Add at least one PDF file to compress.');
            return;
        }

        abortControllerRef.current?.abort();
        const controller = new AbortController();
        abortControllerRef.current = controller;

        setIsLoading(true);
        setProgressPercent(0);
        setProgressLabel('Preparing compression...');
        setSummaryTotals(null);
        clearResult();

        const outputFiles: CompletedCompressedOutput[] = [];
        let totalOriginalSizeBytes = 0;
        let totalCompressedSizeBytes = 0;
        let failedCount = 0;

        try {
            const totalFiles = pdfFiles.length;
            for (let index = 0; index < pdfFiles.length; index++) {
                const fileMeta = pdfFiles[index];
                if (abortControllerRef.current !== controller)
                    return;

                setProgressLabel(`Uploading ${fileMeta.name}...`);
                setProgressPercent(progressForUploadStage(index, totalFiles, 0));

                try {
                    const compressed = await compressPdfFile({
                        file: fileMeta.file,
                        level: compressionLevel,
                        signal: controller.signal,
                        onUploadProgress: (uploadProgress) => {
                            if (abortControllerRef.current !== controller) return;
                            setProgressLabel(`Uploading ${fileMeta.name} (${uploadProgress.percentage.toFixed(0)}%)`);
                            setProgressPercent(
                                progressForUploadStage(index, totalFiles, uploadProgress.percentage)
                            );
                        },
                    });

                    if (abortControllerRef.current !== controller)
                        return;

                    setProgressLabel(`Compressing ${fileMeta.name}...`);
                    setProgressPercent(progressForCompressStage(index, totalFiles));

                    const downloadUrl = compressed.outputDownloadUrl || compressed.outputBlobUrl;

                    outputFiles.push({
                        downloadUrl,
                        file: {
                            url: downloadUrl,
                            filename: compressed.outputFilename,
                            mimeType: 'application/pdf',
                            sizeBytes: compressed.compressedSizeBytes,
                        },
                    });

                    totalOriginalSizeBytes += compressed.originalSizeBytes;
                    totalCompressedSizeBytes += compressed.compressedSizeBytes;

                    setProgressPercent(clampProgress(((index + 1) / totalFiles) * 100));
                } catch (error) {
                    if (isAbortError(error) || controller.signal.aborted)
                        throw error;

                    failedCount += 1;
                    toast.error(`${fileMeta.name}: ${toErrorMessage(error)}`);
                }
            }

            if (abortControllerRef.current !== controller)
                return;

            if (outputFiles.length === 0)
                throw new Error('No files were compressed successfully.');

            const modeLabel = getCompressionModeLabel(compressionLevel);
            let zipFile: ToolResultFile | undefined;

            if (outputFiles.length > 1) {
                try {
                    const zipEntries: Array<{ filename: string; data: Uint8Array }> = [];

                    for (let index = 0; index < outputFiles.length; index++) {
                        if (abortControllerRef.current !== controller)
                            return;

                        const output = outputFiles[index];
                        setProgressLabel(`Preparing ZIP (${index + 1}/${outputFiles.length})...`);
                        setProgressPercent(clampProgress(90 + (((index + 1) / outputFiles.length) * 9)));

                        const bytes = await downloadCompressedPdfBytes({
                            url: output.downloadUrl,
                            signal: controller.signal,
                        });

                        zipEntries.push({
                            filename: output.file.filename,
                            data: bytes,
                        });
                    }

                    const estimatedZipSize = estimateZipSizeBytes(zipEntries);
                    if (estimatedZipSize >= ZIP_MEMORY_WARNING_THRESHOLD_BYTES) {
                        toast(
                            'Large ZIP detected. Mobile devices may need more memory. Individual PDF downloads are also available.'
                        );
                    }

                    setProgressLabel('Preparing ZIP download...');
                    const zipBlob = createZipBlob(zipEntries);
                    zipFile = {
                        url: URL.createObjectURL(zipBlob),
                        filename: 'compressed_output.zip',
                        mimeType: 'application/zip',
                        sizeBytes: zipBlob.size,
                    };
                } catch (error) {
                    if (isAbortError(error) || controller.signal.aborted)
                        throw error;

                    console.error('ZIP generation failed for compressed files:', error);
                    toast.error('ZIP download could not be prepared. Individual PDFs are still available.');
                }
            }

            const nextResult = buildToolResult({
                files: outputFiles.map((output) => output.file),
                modeLabel,
                zipFile,
            });
            setResult(nextResult);

            const reductionPercent = totalOriginalSizeBytes > 0
                ? clampProgress((1 - (totalCompressedSizeBytes / totalOriginalSizeBytes)) * 100)
                : 0;

            const totals: CompressionSummaryTotals = {
                totalOriginalSizeBytes,
                totalCompressedSizeBytes,
                reductionPercent,
                succeededCount: outputFiles.length,
                failedCount,
            };
            setSummaryTotals(totals);

            setProgressPercent(100);
            setProgressLabel('Compression complete');

            if (failedCount > 0) {
                toast.success(
                    `Compressed ${outputFiles.length} file${outputFiles.length === 1 ? '' : 's'} (${failedCount} failed).`
                );
            } else {
                toast.success(`Compression complete (${reductionPercent}% smaller).`);
            }
        } catch (error) {
            if (isAbortError(error) || controller.signal.aborted) {
                if (abortControllerRef.current === controller)
                    toast('Compression cancelled.');
                return;
            }

            console.error('Compression failed:', error);
            toast.error(`Compression failed: ${toErrorMessage(error)}`);
            setResult(null);
            setSummaryTotals(null);
        } finally {
            if (abortControllerRef.current === controller) {
                abortControllerRef.current = null;
                setIsLoading(false);
            }
        }
    }, [
        clearResult,
        compressionLevel,
        pdfFiles,
        setIsLoading,
        setResult,
    ]);

    const summary = useMemo<ToolSummary | null>(() => {
        if (result && summaryTotals) {
            return createCompressCompletedSummary({
                result,
                level: compressionLevel,
                totals: summaryTotals,
            });
        }

        if (result)
            return {
                ...createCompressCompletedSummary({
                    result,
                    level: compressionLevel,
                    totals: {
                        totalOriginalSizeBytes: 0,
                        totalCompressedSizeBytes: result.kind === 'single'
                            ? result.file.sizeBytes
                            : result.kind === 'multi'
                                ? result.files.reduce((sum, file) => sum + file.sizeBytes, 0)
                                : 0,
                        reductionPercent: 0,
                        succeededCount: result.kind === 'multi' ? result.files.length : 1,
                        failedCount: 0,
                    },
                }),
                note: 'Compression completed.',
            };

        return createCompressPlannedSummary(pdfFiles, compressionLevel);
    }, [compressionLevel, pdfFiles, result, summaryTotals]);

    return {
        result,
        summary,
        compressionLevel,
        setCompressionLevel,
        progressPercent,
        progressLabel,
        cancelProcessing,
        handleCompressPdf,
    };
}

export type { CompressionLevel };
