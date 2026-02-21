'use client';

import React from 'react';
import type { DragEndEvent } from '@dnd-kit/core';

import type { FileMeta } from '@/hook/fileMeta';
import type { PdfDndSensors, PdfDropzone } from '@/hook/usePdfFiles';
import UploadPhase from './UploadPhase';
import WorkPhase from './WorkPhase';
import BottomActionBar from './BottomActionBar';
import type { DownloadableResult } from './BottomActionBar';

interface PdfToolLayoutProps {
    title: string;
    description: string;
    actionLabel: string;
    actionIcon?: React.ReactNode;
    onAction: () => void;
    actionDisabled?: boolean;

    dropzone: PdfDropzone;
    files: FileMeta[];

    isProcessing: boolean;
    isGeneratingPreviews: boolean;

    fileLimits: {
        maxFiles: number;
        maxFileSizeMB: number;
    };

    onRemoveFile: (id: string) => void;
    onRotate?: (id: string) => void;
    onClearFiles: () => void;
    onSortByName: () => void;
    sortingOrder: boolean | null;

    dndProps: {
        sensors: PdfDndSensors;
        handleDragEnd: (event: DragEndEvent) => void;
    };

    resultUrl?: string | null;
    resultFilename?: string;
    resultFiles?: DownloadableResult[];
    zipResult?: DownloadableResult | null;
    sidebar?: React.ReactNode;
    fileCardRenderer?: (file: FileMeta) => React.ReactNode;
}

const PdfToolLayout: React.FC<PdfToolLayoutProps> = ({
    title,
    description,
    actionLabel,
    actionIcon,
    onAction,
    actionDisabled = false,
    dropzone,
    files,
    isProcessing,
    isGeneratingPreviews,
    fileLimits,
    onRemoveFile,
    onRotate,
    onClearFiles,
    onSortByName,
    sortingOrder,
    dndProps,
    resultUrl,
    resultFilename,
    resultFiles,
    zipResult,
    sidebar,
    fileCardRenderer,
}) => {
    const { getRootProps, getInputProps, open, isDragActive } = dropzone;
    const hasFiles = files.length > 0;
    const isDisabled = isProcessing || isGeneratingPreviews;

    return (
        <div
            {...getRootProps()}
            className={`relative flex min-h-screen flex-col select-none ${isDragActive ? 'ring-4 ring-inset ring-indigo-400' : ''}`}
        >
            <input {...getInputProps()} disabled={isDisabled} />

            <div
                className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm transition-opacity duration-300 ease-in-out ${isDragActive ? 'opacity-100' : 'opacity-0'}`}
            >
                <div className="rounded-xl border-4 border-dashed border-indigo-500 bg-white p-10 text-2xl font-semibold text-indigo-700 shadow-2xl">
                    Drop PDF files anywhere!
                </div>
            </div>

            {!hasFiles && !isGeneratingPreviews ? (
                <UploadPhase
                    title={title}
                    description={description}
                    onSelectFiles={open}
                    isDisabled={isDisabled}
                    maxFiles={fileLimits.maxFiles}
                    maxFileSizeMB={fileLimits.maxFileSizeMB}
                />
            ) : (
                <>
                    <WorkPhase
                        files={files}
                        onRemoveFile={onRemoveFile}
                        onRotate={onRotate}
                        onClearFiles={onClearFiles}
                        onSortByName={onSortByName}
                        sortingOrder={sortingOrder}
                        onAddMore={open}
                        isDisabled={isDisabled}
                        isGeneratingPreviews={isGeneratingPreviews}
                        sensors={dndProps.sensors}
                        handleDragEnd={dndProps.handleDragEnd}
                        sidebar={sidebar}
                        fileCardRenderer={fileCardRenderer}
                    />

                    <BottomActionBar
                        actionLabel={actionLabel}
                        actionIcon={actionIcon}
                        onAction={onAction}
                        actionDisabled={actionDisabled}
                        isProcessing={isProcessing}
                        resultUrl={resultUrl}
                        resultFilename={resultFilename}
                        resultFiles={resultFiles}
                        zipResult={zipResult}
                    />
                </>
            )}
        </div>
    );
};

export default PdfToolLayout;
