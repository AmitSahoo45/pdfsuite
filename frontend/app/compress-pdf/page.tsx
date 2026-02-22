'use client';

import React from 'react';
import { Minimize2 } from 'lucide-react';

import PdfToolLayout from '@/components/layout/PdfToolLayout';
import { useCompressPdf, type CompressionLevel } from '@/hook/useCompressPdf';
import { usePdfFiles } from '@/hook/usePdfFiles';

const LEVEL_OPTIONS: Array<{
    level: CompressionLevel;
    title: string;
    description: string;
}> = [
    {
        level: 'recommended',
        title: 'Recommended Compression',
        description: 'Balanced size reduction and visual quality for most PDFs.',
    },
    {
        level: 'less',
        title: 'Less Compression',
        description: 'Smaller reduction, higher visual quality preservation.',
    },
];

const CompressPDF = () => {
    const pdf = usePdfFiles({
        maxFiles: 5,
        maxFileSizeMB: 25,
    });
    const compress = useCompressPdf({
        pdfFiles: pdf.pdfFiles,
        setIsLoading: pdf.setIsLoading,
    });

    const compressionSidebar = (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Compression level
            </h3>

            {LEVEL_OPTIONS.map((option) => {
                const isActive = compress.compressionLevel === option.level;
                return (
                    <label
                        key={option.level}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${isActive
                            ? 'border-red-200 bg-red-50/50'
                            : 'border-gray-200 hover:border-gray-300'
                            }`}
                    >
                        <input
                            type="radio"
                            name="compressionLevel"
                            checked={isActive}
                            onChange={() => compress.setCompressionLevel(option.level)}
                            className="mt-0.5 accent-red-500"
                        />
                        <div>
                            <p className="text-sm font-medium text-gray-800">{option.title}</p>
                            <p className="text-xs text-gray-500">{option.description}</p>
                        </div>
                    </label>
                );
            })}

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
                Compression quality depends heavily on image content. Text-only PDFs may show smaller reductions.
            </div>
        </div>
    );

    return (
        <PdfToolLayout
            title="Compress PDF"
            description="Reduce PDF file size while keeping documents readable and easy to share."
            actionLabel="Compress PDF"
            actionIcon={<Minimize2 className="h-5 w-5" />}
            onAction={compress.handleCompressPdf}
            actionDisabled={pdf.pdfFiles.length === 0}
            dropzone={pdf.dropzone}
            files={pdf.pdfFiles}
            isProcessing={pdf.isLoading}
            isGeneratingPreviews={pdf.isGeneratingPreviews}
            progressPercent={compress.progressPercent}
            progressLabel={compress.progressLabel}
            onCancelProcessing={compress.cancelProcessing}
            fileLimits={pdf.fileLimits}
            onRemoveFile={pdf.handleRemoveFile}
            onClearFiles={pdf.handleClearFiles}
            onSortByName={pdf.handleSortByName}
            sortingOrder={pdf.sortingOrder}
            dndProps={{
                sensors: pdf.sensors,
                handleDragEnd: pdf.handleDragEnd,
            }}
            result={compress.result}
            summary={compress.summary}
            sidebar={compressionSidebar}
        />
    );
};

export default CompressPDF;
