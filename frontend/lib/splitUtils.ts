export type PageRange = {
    start: number;
    end: number;
};

export type ParsedPageRanges =
    | { ok: true; ranges: PageRange[] }
    | { ok: false; error: string };

const rangeTokenPattern = /^(\d+)(?:-(\d+))?$/;

export const parsePageRanges = (input: string, maxPages: number): ParsedPageRanges => {
    const raw = input.trim();
    if (!raw)
        return { ok: false, error: 'Please provide at least one page or range.' };

    const tokens = raw
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean);

    if (tokens.length === 0)
        return { ok: false, error: 'Please provide at least one page or range.' };

    const ranges: PageRange[] = [];

    for (const token of tokens) {
        const match = token.match(rangeTokenPattern);
        if (!match)
            return { ok: false, error: `Invalid token "${token}". Use formats like 1, 3-5.` };

        const start = Number(match[1]);
        const end = match[2] ? Number(match[2]) : start;

        if (!Number.isInteger(start) || !Number.isInteger(end) || start < 1 || end < 1)
            return { ok: false, error: `Invalid token "${token}". Pages must be positive integers.` };

        if (start > end)
            return { ok: false, error: `Invalid token "${token}". Range start must be <= end.` };

        if (end > maxPages)
            return {
                ok: false,
                error: `Range "${token}" exceeds page count (${maxPages}).`,
            };

        ranges.push({ start, end });
    }

    return { ok: true, ranges };
};

export const expandRangesToPageIndices = (
    ranges: PageRange[],
    options?: { dedupe?: boolean }
): number[] => {
    const indices: number[] = [];
    const seen = new Set<number>();
    const dedupe = options?.dedupe ?? false;

    for (const range of ranges) {
        for (let page = range.start; page <= range.end; page++) {
            const index = page - 1;
            if (dedupe) {
                if (seen.has(index)) continue;
                seen.add(index);
            }
            indices.push(index);
        }
    }

    return indices;
};

export const buildFixedPageGroups = (pageCount: number, chunkSize: number): number[][] => {
    const size = Math.floor(chunkSize);
    if (!Number.isFinite(size) || size < 1)
        return [];

    const groups: number[][] = [];
    for (let start = 0; start < pageCount; start += size) {
        const group: number[] = [];
        const endExclusive = Math.min(start + size, pageCount);
        for (let page = start; page < endExclusive; page++) {
            group.push(page);
        }
        groups.push(group);
    }

    return groups;
};

export const getPdfBaseName = (filename: string): string =>
    filename.replace(/\.pdf$/i, '').trim() || 'document';
