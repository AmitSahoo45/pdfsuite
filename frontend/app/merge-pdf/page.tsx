'use client';

import React from 'react';
import { Merge } from 'lucide-react';

import { useMergePdf } from '@/hook/useMergePdf';
import { usePdfFiles } from '@/hook/usePdfFiles';
import PdfToolLayout from '@/components/layout/PdfToolLayout';

const MergePDF = () => {
    const pdf = usePdfFiles();
    const { mergedPdfUrl, handleMergePdfs } = useMergePdf({
        pdfFiles: pdf.pdfFiles,
        setIsLoading: pdf.setIsLoading,
    });

    return (
        <PdfToolLayout
            title="Merge PDF"
            description="Combine PDFs in the order you want with the easiest PDF merger available."
            actionLabel="Merge PDF"
            actionIcon={<Merge className="h-5 w-5" />}
            onAction={handleMergePdfs}
            actionDisabled={pdf.pdfFiles.length < 2}
            dropzone={pdf.dropzone}
            files={pdf.pdfFiles}
            isProcessing={pdf.isLoading}
            isGeneratingPreviews={pdf.isGeneratingPreviews}
            fileLimits={pdf.fileLimits}
            onRemoveFile={pdf.handleRemoveFile}
            onRotate={pdf.handleRotate}
            onClearFiles={pdf.handleClearFiles}
            onSortByName={pdf.handleSortByName}
            sortingOrder={pdf.sortingOrder}
            dndProps={{
                sensors: pdf.sensors,
                handleDragEnd: pdf.handleDragEnd,
            }}
            resultUrl={mergedPdfUrl}
            resultFilename="merged_document.pdf"
        />
    );
};

export default MergePDF;
