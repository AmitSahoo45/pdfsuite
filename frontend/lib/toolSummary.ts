import type { ToolResult, ToolSummary } from '@/types/toolResult';

const MAX_SUMMARY_NAMES = 12;

const toSummaryNames = (names: string[]): {
    outputNames: string[];
    hiddenOutputNameCount?: number;
} => {
    if (names.length <= MAX_SUMMARY_NAMES)
        return { outputNames: names };

    return {
        outputNames: names.slice(0, MAX_SUMMARY_NAMES),
        hiddenOutputNameCount: names.length - MAX_SUMMARY_NAMES,
    };
};

export const formatByteSize = (bytes: number | null): string => {
    if (bytes === null)
        return 'Available after processing';

    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    if (bytes < 1024 * 1024 * 1024)
        return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const summarizeToolResult = (result: ToolResult): ToolSummary => {
    if (result.kind === 'single') {
        if (result.file.mimeType === 'application/zip') {
            return {
                phase: 'completed',
                modeLabel: result.modeLabel,
                outputCount: 0,
                outputNames: [],
                totalSizeBytes: null,
                isEstimatedSize: false,
                zipAvailable: true,
                zipName: result.file.filename,
                zipSizeBytes: result.file.sizeBytes,
            };
        }

        return {
            phase: 'completed',
            modeLabel: result.modeLabel,
            outputCount: 1,
            outputNames: [result.file.filename],
            totalSizeBytes: result.file.sizeBytes,
            isEstimatedSize: false,
            zipAvailable: false,
        };
    }

    if (result.kind === 'zip') {
        return {
            phase: 'completed',
            modeLabel: result.modeLabel,
            outputCount: 0,
            outputNames: [],
            totalSizeBytes: null,
            isEstimatedSize: false,
            zipAvailable: true,
            zipName: result.file.filename,
            zipSizeBytes: result.file.sizeBytes,
        };
    }

    const names = result.files.map((file) => file.filename);
    const sizedNames = toSummaryNames(names);
    const totalSizeBytes = result.files.reduce((sum, file) => sum + file.sizeBytes, 0);

    return {
        phase: 'completed',
        modeLabel: result.modeLabel,
        outputCount: result.files.length,
        outputNames: sizedNames.outputNames,
        hiddenOutputNameCount: sizedNames.hiddenOutputNameCount,
        totalSizeBytes,
        isEstimatedSize: false,
        zipAvailable: Boolean(result.zipFile),
        zipName: result.zipFile?.filename,
        zipSizeBytes: result.zipFile?.sizeBytes ?? null,
    };
};
