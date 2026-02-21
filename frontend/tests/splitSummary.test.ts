import { describe, expect, it } from 'vitest';

import { createSplitPlannedSummary, getSplitModeLabel } from '@/lib/splitSummary';
import type { FileMeta } from '@/hook/fileMeta';

const createMeta = ({
    name,
    size,
    pages,
}: {
    name: string;
    size: number;
    pages: number;
}): FileMeta => ({
    id: `${name}-${size}-${pages}`,
    file: { arrayBuffer: async () => new ArrayBuffer(0) } as unknown as File,
    name,
    size,
    pages,
    rotation: 0,
    previewImageUrl: '/preview.svg',
});

describe('splitSummary', () => {
    it('returns readable labels for all split modes', () => {
        expect(getSplitModeLabel('range')).toBe('Split by range');
        expect(getSplitModeLabel('extract-all')).toBe('Extract all pages');
        expect(getSplitModeLabel('extract-selected')).toBe('Extract selected pages');
        expect(getSplitModeLabel('fixed')).toBe('Split every N pages');
    });

    it('builds planned summary for range mode', () => {
        const summary = createSplitPlannedSummary({
            pdfFiles: [createMeta({ name: 'doc.pdf', size: 5000, pages: 5 })],
            splitMode: 'range',
            rangeInput: '1-2,4',
            selectedPagesInput: '1',
            fixedChunkSize: 2,
            mergeOutputs: false,
        });

        expect(summary).not.toBeNull();
        if (!summary) return;
        expect(summary.outputCount).toBe(2);
        expect(summary.outputNames).toEqual([
            'doc_pages_1-2.pdf',
            'doc_pages_4-4.pdf',
        ]);
        expect(summary.zipAvailable).toBe(true);
        expect(summary.totalSizeBytes).toBe(3000);
    });

    it('builds planned summary for merged outputs', () => {
        const summary = createSplitPlannedSummary({
            pdfFiles: [createMeta({ name: 'doc.pdf', size: 8000, pages: 4 })],
            splitMode: 'extract-all',
            rangeInput: '1',
            selectedPagesInput: '1',
            fixedChunkSize: 2,
            mergeOutputs: true,
        });

        expect(summary).not.toBeNull();
        if (!summary) return;
        expect(summary.outputCount).toBe(1);
        expect(summary.outputNames).toEqual(['split_output.pdf']);
        expect(summary.zipAvailable).toBe(false);
        expect(summary.totalSizeBytes).toBe(8000);
    });
});
