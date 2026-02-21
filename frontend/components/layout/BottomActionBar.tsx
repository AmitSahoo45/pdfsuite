'use client';

import React from 'react';
import { Download, Loader2, X } from 'lucide-react';

import type { ToolResult, ToolResultFile } from '@/types/toolResult';

interface BottomActionBarProps {
    actionLabel: string;
    actionIcon?: React.ReactNode;
    onAction: () => void;
    actionDisabled?: boolean;
    isProcessing: boolean;
    result?: ToolResult | null;
    progressPercent?: number;
    progressLabel?: string;
    onCancelProcessing?: () => void;
}

const triggerDownload = (file: ToolResultFile) => {
    const link = document.createElement('a');
    link.href = file.url;
    link.download = file.filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
};

const BottomActionBar: React.FC<BottomActionBarProps> = ({
    actionLabel,
    actionIcon,
    onAction,
    actionDisabled,
    isProcessing,
    result,
    progressPercent = 0,
    progressLabel,
    onCancelProcessing,
}) => {
    const pdfDownloads: ToolResultFile[] = [];
    let zipDownload: ToolResultFile | null = null;

    if (result) {
        if (result.kind === 'single') {
            if (result.file.mimeType === 'application/zip')
                zipDownload = result.file;
            else
                pdfDownloads.push(result.file);
        } else if (result.kind === 'zip') {
            zipDownload = result.file;
        } else {
            pdfDownloads.push(...result.files);
            if (result.zipFile)
                zipDownload = result.zipFile;
        }
    }

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur-sm">
            <div className="container mx-auto flex items-center justify-center gap-3 px-4 py-3">
                <button
                    onClick={onAction}
                    disabled={actionDisabled || isProcessing}
                    className="flex items-center gap-2 rounded-xl bg-red-500 px-8 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-red-600 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            {progressLabel || `Processing... ${progressPercent}%`}
                        </>
                    ) : (
                        <>
                            {actionIcon}
                            {actionLabel}
                        </>
                    )}
                </button>

                {isProcessing && onCancelProcessing && (
                    <button
                        type="button"
                        onClick={onCancelProcessing}
                        className="flex items-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                    >
                        <X className="h-4 w-4" />
                        Cancel
                    </button>
                )}

                {pdfDownloads.length === 1 && !isProcessing && (
                    <a
                        href={pdfDownloads[0].url}
                        download={pdfDownloads[0].filename}
                        className="flex items-center gap-2 rounded-xl bg-sky-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-sky-700 hover:shadow-lg active:scale-[0.98]"
                    >
                        <Download className="h-5 w-5" />
                        Download PDF
                    </a>
                )}

                {pdfDownloads.length > 1 && !isProcessing && (
                    <button
                        type="button"
                        onClick={() => pdfDownloads.forEach((file) => triggerDownload(file))}
                        className="flex items-center gap-2 rounded-xl bg-sky-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-sky-700 hover:shadow-lg active:scale-[0.98]"
                    >
                        <Download className="h-5 w-5" />
                        Download PDFs ({pdfDownloads.length})
                    </button>
                )}

                {zipDownload && !isProcessing && (
                    <a
                        href={zipDownload.url}
                        download={zipDownload.filename}
                        className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-green-700 hover:shadow-lg active:scale-[0.98]"
                    >
                        <Download className="h-5 w-5" />
                        Download ZIP
                    </a>
                )}
            </div>
        </div>
    );
};

export default BottomActionBar;
