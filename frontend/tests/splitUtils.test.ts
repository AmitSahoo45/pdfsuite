import { describe, expect, it } from 'vitest';

import {
    buildFixedPageGroups,
    expandRangesToPageIndices,
    parsePageRanges,
} from '@/lib/splitUtils';

describe('splitUtils', () => {
    it('parses valid page ranges', () => {
        const parsed = parsePageRanges('1-3, 5, 8-9', 12);
        expect(parsed.ok).toBe(true);
        if (!parsed.ok) return;

        expect(parsed.ranges).toEqual([
            { start: 1, end: 3 },
            { start: 5, end: 5 },
            { start: 8, end: 9 },
        ]);
    });

    it('rejects ranges beyond document pages', () => {
        const parsed = parsePageRanges('1-5', 4);
        expect(parsed.ok).toBe(false);
        if (parsed.ok) return;
        expect(parsed.error).toContain('exceeds page count');
    });

    it('expands ranges and supports dedupe', () => {
        const noDedupe = expandRangesToPageIndices(
            [{ start: 1, end: 2 }, { start: 2, end: 3 }],
            { dedupe: false }
        );
        const dedupe = expandRangesToPageIndices(
            [{ start: 1, end: 2 }, { start: 2, end: 3 }],
            { dedupe: true }
        );

        expect(noDedupe).toEqual([0, 1, 1, 2]);
        expect(dedupe).toEqual([0, 1, 2]);
    });

    it('builds fixed-size page groups', () => {
        expect(buildFixedPageGroups(5, 2)).toEqual([[0, 1], [2, 3], [4]]);
        expect(buildFixedPageGroups(3, 0)).toEqual([]);
    });
});
