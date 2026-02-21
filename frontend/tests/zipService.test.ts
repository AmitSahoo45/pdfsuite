import { describe, expect, it } from 'vitest';

import { createZipBlob, estimateZipSizeBytes } from '@/service/zipService';

describe('zipService', () => {
    it('creates a valid zip signature', async () => {
        const blob = createZipBlob([
            { filename: 'a.txt', data: new TextEncoder().encode('hello') },
            { filename: 'b.txt', data: new TextEncoder().encode('world') },
        ]);

        expect(blob.type).toBe('application/zip');
        const bytes = new Uint8Array(await blob.arrayBuffer());

        // Local file header signature (PK\003\004)
        expect(bytes[0]).toBe(0x50);
        expect(bytes[1]).toBe(0x4b);
        expect(bytes[2]).toBe(0x03);
        expect(bytes[3]).toBe(0x04);
    });

    it('throws when entries are empty', () => {
        expect(() => createZipBlob([])).toThrow('Cannot create a ZIP with no files.');
    });

    it('estimates zip size consistently with generated blob', () => {
        const entries = [
            { filename: 'a.txt', data: new TextEncoder().encode('hello') },
            { filename: 'b.txt', data: new TextEncoder().encode('world') },
        ];
        const estimatedSize = estimateZipSizeBytes(entries);
        const blob = createZipBlob(entries);

        expect(estimatedSize).toBe(blob.size);
    });
});
