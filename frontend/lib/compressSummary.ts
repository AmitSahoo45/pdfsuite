import type { FileMeta } from '@/hook/fileMeta';
import { formatByteSize, summarizeToolResult } from '@/lib/toolSummary';
import type { CompressionLevel } from '@/service/pdfCompressService';
import type { ToolResult, ToolSummary } from '@/types/toolResult';

export interface CompressionSummaryTotals {
    totalOriginalSizeBytes: number;
    totalCompressedSizeBytes: number;
    reductionPercent: number;
    succeededCount: number;
    failedCount: number;
}

const MAX_NAMES = 20;

export const getCompressionLevelLabel = (level: CompressionLevel): string =>
    level === 'recommended' ? 'Recommended' : 'Less';

export const getCompressionModeLabel = (level: CompressionLevel): string =>
    `Compress PDF (${getCompressionLevelLabel(level)})`;

const summarizeNames = (names: string[]) => {
    if (names.length <= MAX_NAMES) {
        return {
            outputNames: names,
            hiddenOutputNameCount: undefined as number | undefined,
        };
    }

    return {
        outputNames: names.slice(0, MAX_NAMES),
        hiddenOutputNameCount: names.length - MAX_NAMES,
    };
};

export const createCompressPlannedSummary = (
    pdfFiles: FileMeta[],
    level: CompressionLevel
): ToolSummary | null => {
    if (pdfFiles.length === 0)
        return null;

    const outputNames = pdfFiles.map((file) =>
        file.name.replace(/\.pdf$/i, '_compressed.pdf')
    );
    const names = summarizeNames(outputNames);
    const totalSizeBytes = pdfFiles.reduce((sum, file) => sum + file.size, 0);

    return {
        phase: 'planned',
        modeLabel: getCompressionModeLabel(level),
        outputCount: pdfFiles.length,
        outputNames: names.outputNames,
        hiddenOutputNameCount: names.hiddenOutputNameCount,
        totalSizeBytes,
        isEstimatedSize: true,
        zipAvailable: pdfFiles.length > 1,
        zipName: pdfFiles.length > 1 ? 'compressed_output.zip' : undefined,
        zipSizeBytes: pdfFiles.length > 1 ? null : undefined,
        note: 'Original file sizes shown. Actual reduction depends on PDF content and image density.',
    };
};

export const createCompressCompletedSummary = ({
    result,
    level,
    totals,
}: {
    result: ToolResult;
    level: CompressionLevel;
    totals: CompressionSummaryTotals;
}): ToolSummary => {
    const base = summarizeToolResult(result);
    const failedNote = totals.failedCount > 0
        ? ` ${totals.failedCount} file${totals.failedCount === 1 ? '' : 's'} failed.`
        : '';
    const zipNote = result.kind === 'multi'
        ? result.zipFile
            ? ' ZIP download is available for all compressed PDFs.'
            : ' ZIP download could not be prepared; individual PDFs are still available.'
        : '';

    return {
        ...base,
        modeLabel: getCompressionModeLabel(level),
        note: `Reduced from ${formatByteSize(totals.totalOriginalSizeBytes)} to ${formatByteSize(totals.totalCompressedSizeBytes)} (${totals.reductionPercent}% smaller).${failedNote}${zipNote}`,
    };
};
