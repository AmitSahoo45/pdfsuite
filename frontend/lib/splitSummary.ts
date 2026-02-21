import type { FileMeta } from '@/hook/fileMeta';
import {
    buildFixedPageGroups,
    expandRangesToPageIndices,
    getPdfBaseName,
    parsePageRanges,
} from '@/lib/splitUtils';
import type { SplitMode } from '@/service/pdfSplitService';
import type { ToolSummary } from '@/types/toolResult';

const MAX_SUMMARY_NAMES = 20;

const expandRange = (start: number, end: number): number[] => {
    const indices: number[] = [];
    for (let page = start; page <= end; page++) {
        indices.push(page - 1);
    }
    return indices;
};

export const getSplitModeLabel = (mode: SplitMode): string => {
    if (mode === 'range') return 'Split by range';
    if (mode === 'extract-all') return 'Extract all pages';
    if (mode === 'extract-selected') return 'Extract selected pages';
    return 'Split every N pages';
};

interface CreateSplitPlannedSummaryOptions {
    pdfFiles: FileMeta[];
    splitMode: SplitMode;
    rangeInput: string;
    selectedPagesInput: string;
    fixedChunkSize: number;
    mergeOutputs: boolean;
}

export const createSplitPlannedSummary = ({
    pdfFiles,
    splitMode,
    rangeInput,
    selectedPagesInput,
    fixedChunkSize,
    mergeOutputs,
}: CreateSplitPlannedSummaryOptions): ToolSummary | null => {
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
        modeLabel: getSplitModeLabel(splitMode),
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
