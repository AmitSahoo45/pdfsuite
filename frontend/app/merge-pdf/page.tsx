'use client';

import React from 'react';
import { Merge } from 'lucide-react';

import { useMergePdf } from '@/hook/useMergePdf';
import { usePdfFiles } from '@/hook/usePdfFiles';
import PdfToolLayout from '@/components/layout/PdfToolLayout';

const MergePDF = () => {
    const pdf = usePdfFiles();
    const merge = useMergePdf({
        pdfFiles: pdf.pdfFiles,
        setIsLoading: pdf.setIsLoading,
    });

    return (
        <PdfToolLayout
            title="Merge PDF"
            description="Combine PDFs in the order you want with the easiest PDF merger available."
            actionLabel="Merge PDF"
            actionIcon={<Merge className="h-5 w-5" />}
            onAction={merge.handleMergePdfs}
            actionDisabled={pdf.pdfFiles.length < 2}
            dropzone={pdf.dropzone}
            files={pdf.pdfFiles}
            isProcessing={pdf.isLoading}
            isGeneratingPreviews={pdf.isGeneratingPreviews}
            progressPercent={merge.progressPercent}
            progressLabel={merge.progressLabel}
            onCancelProcessing={merge.cancelProcessing}
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
            result={merge.result}
            summary={merge.summary}
        />
    );
};

export default MergePDF;
