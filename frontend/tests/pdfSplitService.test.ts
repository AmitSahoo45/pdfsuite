import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';

import { splitPdfFiles } from '@/service/pdfSplitService';
import { isAbortError } from '@/service/processing';

const createPdfBytes = async (pages: number): Promise<Uint8Array> => {
    const doc = await PDFDocument.create();
    for (let i = 0; i < pages; i++) {
        doc.addPage([300, 400]);
    }
    return doc.save();
};

const createFakeFile = (bytes: Uint8Array): File => ({
    arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
} as unknown as File);

describe('pdfSplitService modes', () => {
    it('splits by range into expected outputs', async () => {
        const bytes = await createPdfBytes(5);

        const result = await splitPdfFiles({
            files: [{ name: 'doc.pdf', file: createFakeFile(bytes), rotation: 0 }],
            mode: 'range',
            rangeInput: '1-2,4',
            selectedPagesInput: '1',
            fixedChunkSize: 2,
            mergeOutputs: false,
        });

        expect(result.outputs).toHaveLength(2);
        expect(result.outputs[0].filename).toContain('pages_1-2');
        expect(result.outputs[1].filename).toContain('pages_4-4');
    });

    it('splits by fixed chunk size', async () => {
        const bytes = await createPdfBytes(5);
        const result = await splitPdfFiles({
            files: [{ name: 'doc.pdf', file: createFakeFile(bytes), rotation: 0 }],
            mode: 'fixed',
            rangeInput: '1-2',
            selectedPagesInput: '1',
            fixedChunkSize: 2,
            mergeOutputs: false,
        });

        expect(result.outputs).toHaveLength(3);
        expect(result.outputs[0].filename).toContain('part_1');
        expect(result.outputs[2].filename).toContain('part_3');
    });

    it('extracts selected pages', async () => {
        const bytes = await createPdfBytes(5);
        const result = await splitPdfFiles({
            files: [{ name: 'doc.pdf', file: createFakeFile(bytes), rotation: 0 }],
            mode: 'extract-selected',
            rangeInput: '1-2',
            selectedPagesInput: '2,4-5',
            fixedChunkSize: 2,
            mergeOutputs: false,
        });

        expect(result.outputs).toHaveLength(3);
        expect(result.outputs[0].filename).toContain('page_2');
        expect(result.outputs[2].filename).toContain('page_5');
    });

    it('produces a single merged file when mergeOutputs is enabled', async () => {
        const bytes = await createPdfBytes(3);
        const result = await splitPdfFiles({
            files: [{ name: 'doc.pdf', file: createFakeFile(bytes), rotation: 0 }],
            mode: 'extract-all',
            rangeInput: '1-2',
            selectedPagesInput: '1',
            fixedChunkSize: 2,
            mergeOutputs: true,
        });

        expect(result.outputs).toHaveLength(1);
        expect(result.outputs[0].filename).toBe('split_output.pdf');
    });

    it('supports cancellation via AbortSignal', async () => {
        const bytes = await createPdfBytes(5);
        const controller = new AbortController();
        controller.abort();

        try {
            await splitPdfFiles({
                files: [{ name: 'doc.pdf', file: createFakeFile(bytes), rotation: 0 }],
                mode: 'extract-all',
                rangeInput: '1-2',
                selectedPagesInput: '1',
                fixedChunkSize: 2,
                mergeOutputs: false,
                signal: controller.signal,
            });
            expect.fail('Expected splitPdfFiles to throw on abort');
        } catch (error) {
            expect(isAbortError(error)).toBe(true);
        }
    });
});
