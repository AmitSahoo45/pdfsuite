'use client';
import {
    useCallback,
    useEffect,
    useState,
    type Dispatch,
    type SetStateAction,
} from 'react';
import { degrees, PDFDocument } from 'pdf-lib';
import toast from 'react-hot-toast';
import type { FileMeta } from '@/hook/fileMeta';

interface UseMergePdfOptions {
    pdfFiles: FileMeta[];
    setIsLoading: Dispatch<SetStateAction<boolean>>;
}

const revokeBlobUrl = (url: string | null) => {
    if (url?.startsWith('blob:'))
        URL.revokeObjectURL(url);
};

export function useMergePdf({ pdfFiles, setIsLoading }: UseMergePdfOptions) {
    const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);

    useEffect(() => {
        return () => {
            revokeBlobUrl(mergedPdfUrl);
        };
    }, [mergedPdfUrl]);

    const handleMergePdfs = useCallback(async () => {
        if (pdfFiles.length < 2) {
            toast.error('You need at least two PDF files to merge.');
            return;
        }

        setIsLoading(true);
        revokeBlobUrl(mergedPdfUrl);
        setMergedPdfUrl(null);

        try {
            const mergedPdf = await PDFDocument.create();

            for (const fileMeta of pdfFiles) {
                try {
                    const pdfBytes = await fileMeta.file.arrayBuffer();
                    const doc = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

                    const indices = doc.getPageIndices();
                    if (indices.length === 0) continue;

                    const copiedPages = await mergedPdf.copyPages(doc, indices);
                    copiedPages.forEach((page) => {
                        const originalRotation = page.getRotation().angle;
                        page.setRotation(degrees((originalRotation + fileMeta.rotation) % 360));
                        mergedPdf.addPage(page);
                    });
                } catch (loadError) {
                    console.log(`Error processing ${fileMeta.name}:`, loadError);
                    toast.error(`Skipping ${fileMeta.name} due to an error during processing.`);
                }
            }

            if (mergedPdf.getPageCount() === 0)
                throw new Error('No pages could be added to the merged document. Check input files.');

            const mergedPdfBytes = await mergedPdf.save();
            const arrayBuffer = new ArrayBuffer(mergedPdfBytes.byteLength);
            new Uint8Array(arrayBuffer).set(mergedPdfBytes);

            const blob = new Blob([arrayBuffer], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);

            setMergedPdfUrl(url);
            toast.success('PDFs merged successfully!');
        } catch (error) {
            console.error('Error merging PDFs:', error);
            toast.error(`Merge failed: ${error instanceof Error ? error.message : String(error)}`);
            setMergedPdfUrl(null);
        } finally {
            setIsLoading(false);
        }
    }, [pdfFiles, setIsLoading, mergedPdfUrl]);

    return {
        mergedPdfUrl,
        handleMergePdfs,
    };
}
