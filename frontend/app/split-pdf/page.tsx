'use client';

import React from 'react';
import { Scissors } from 'lucide-react';
import toast from 'react-hot-toast';

import { usePdfFiles } from '@/hook/usePdfFiles';
import PdfToolLayout from '@/components/layout/PdfToolLayout';

const SplitPDF = () => {
    const pdf = usePdfFiles();

    // TODO: Implement actual split logic
    const handleSplitPdf = async () => {
        if (pdf.pdfFiles.length < 1) {
            toast.error('You need at least one PDF file to split.');
            return;
        }
        toast('Split functionality coming soon!');
    };

    // TODO: Build out split-specific sidebar with range options
    const splitSidebar = (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Split options
            </h3>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-red-200 bg-red-50/50 p-3">
                <input
                    type="radio"
                    name="splitMode"
                    defaultChecked
                    className="mt-0.5 accent-red-500"
                />
                <div>
                    <p className="text-sm font-medium text-gray-800">Split by range</p>
                    <p className="text-xs text-gray-500">
                        Select custom page ranges to extract
                    </p>
                </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 transition hover:border-gray-300">
                <input
                    type="radio"
                    name="splitMode"
                    className="mt-0.5 accent-red-500"
                />
                <div>
                    <p className="text-sm font-medium text-gray-800">Extract all pages</p>
                    <p className="text-xs text-gray-500">
                        Get every page as a separate PDF
                    </p>
                </div>
            </label>

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 transition hover:border-gray-300">
                <input
                    type="radio"
                    name="splitMode"
                    className="mt-0.5 accent-red-500"
                />
                <div>
                    <p className="text-sm font-medium text-gray-800">Split every N pages</p>
                    <p className="text-xs text-gray-500">
                        Split into chunks of fixed size
                    </p>
                </div>
            </label>
        </div>
    );

    return (
        <PdfToolLayout
            title="Split PDF"
            description="Separate one page or a whole set for easy conversion into independent PDF files."
            actionLabel="Split PDF"
            actionIcon={<Scissors className="h-5 w-5" />}
            onAction={handleSplitPdf}
            actionDisabled={pdf.pdfFiles.length < 1}
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
            sidebar={splitSidebar}
        />
    );
};

export default SplitPDF;