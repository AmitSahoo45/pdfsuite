'use client';

import React from 'react';
import { Scissors } from 'lucide-react';

import { useSplitPdf, type SplitMode } from '@/hook/useSplitPdf';
import { usePdfFiles } from '@/hook/usePdfFiles';
import PdfToolLayout from '@/components/layout/PdfToolLayout';

const SplitPDF = () => {
    const pdf = usePdfFiles();
    const split = useSplitPdf({
        pdfFiles: pdf.pdfFiles,
        setIsLoading: pdf.setIsLoading,
    });

    const modeOptions: Array<{
        mode: SplitMode;
        title: string;
        description: string;
    }> = [
        {
            mode: 'range',
            title: 'Split by range',
            description: 'Custom ranges like 1-3, 8, 10-12',
        },
        {
            mode: 'extract-all',
            title: 'Extract all pages',
            description: 'Each page becomes a separate PDF',
        },
        {
            mode: 'extract-selected',
            title: 'Extract selected pages',
            description: 'Select pages to extract using ranges',
        },
        {
            mode: 'fixed',
            title: 'Split every N pages',
            description: 'Split into fixed-size chunks',
        },
    ];

    const modeHelpText = (() => {
        if (split.splitMode === 'range')
            return 'Use comma-separated pages/ranges. Example: 1-3, 5, 8-10';
        if (split.splitMode === 'extract-selected')
            return 'Use comma-separated pages/ranges. Example: 1, 4-6, 9';
        if (split.splitMode === 'fixed')
            return 'Each output PDF will contain N pages.';
        return 'Every page will be extracted to its own PDF.';
    })();

    const sectionLabel = (() => {
        if (split.splitMode === 'range')
            return 'Page ranges';
        if (split.splitMode === 'extract-selected')
            return 'Selected pages';
        if (split.splitMode === 'fixed')
            return 'Pages per split';
        return '';
    })();

    const sectionControl = (() => {
        if (split.splitMode === 'range') {
            return (
                <input
                    type="text"
                    value={split.rangeInput}
                    onChange={(e) => split.setRangeInput(e.target.value)}
                    placeholder="1-3, 5, 8-10"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                />
            );
        }

        if (split.splitMode === 'extract-selected') {
            return (
                <input
                    type="text"
                    value={split.selectedPagesInput}
                    onChange={(e) => split.setSelectedPagesInput(e.target.value)}
                    placeholder="1, 4-6, 9"
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                />
            );
        }

        if (split.splitMode === 'fixed') {
            return (
                <input
                    type="number"
                    min={1}
                    value={split.fixedChunkSize}
                    onChange={(e) => split.setFixedChunkSize(Number(e.target.value))}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-red-400 focus:outline-none focus:ring-2 focus:ring-red-100"
                />
            );
        }

        return null;
    })();

    const mergeLabel = split.splitMode === 'extract-all' || split.splitMode === 'extract-selected'
        ? 'Merge extracted pages into one PDF'
        : 'Merge split outputs into one PDF';

    const handleModeChange = (mode: SplitMode) => {
        split.setSplitMode(mode);
        if (mode === 'extract-all')
            split.setMergeOutputs(false);
    };

    const splitSidebar = (
        <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                Split options
            </h3>

            {modeOptions.map((option) => {
                const isActive = split.splitMode === option.mode;
                return (
                    <label
                        key={option.mode}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition ${isActive
                            ? 'border-red-200 bg-red-50/50'
                            : 'border-gray-200 hover:border-gray-300'
                            }`}
                    >
                        <input
                            type="radio"
                            name="splitMode"
                            checked={isActive}
                            onChange={() => handleModeChange(option.mode)}
                            className="mt-0.5 accent-red-500"
                        />
                        <div>
                            <p className="text-sm font-medium text-gray-800">{option.title}</p>
                            <p className="text-xs text-gray-500">{option.description}</p>
                        </div>
                    </label>
                );
            })}

            {sectionControl && (
                <div className="space-y-1.5">
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        {sectionLabel}
                    </p>
                    {sectionControl}
                    <p className="text-xs text-gray-400">
                        {modeHelpText}
                    </p>
                </div>
            )}

            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 p-3 transition hover:border-gray-300">
                <input
                    type="checkbox"
                    checked={split.mergeOutputs}
                    onChange={(e) => split.setMergeOutputs(e.target.checked)}
                    className="mt-0.5 accent-red-500"
                />
                <div>
                    <p className="text-sm font-medium text-gray-800">
                        {mergeLabel}
                    </p>
                    <p className="text-xs text-gray-500">
                        Outputs a single PDF instead of multiple files.
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
            onAction={split.handleSplitPdf}
            actionDisabled={split.actionDisabled}
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
            resultUrl={split.resultUrl}
            resultFilename={split.resultFilename}
            resultFiles={split.resultFiles}
            zipResult={split.zipResult}
            sidebar={splitSidebar}
        />
    );
};

export default SplitPDF;
