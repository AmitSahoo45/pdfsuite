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
    const [isPdfListOpen, setIsPdfListOpen] = React.useState(false);
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

    const showDownloads = !isProcessing && (pdfDownloads.length > 0 || Boolean(zipDownload));
    const hasBothDownloadOptions = !isProcessing && pdfDownloads.length > 0 && Boolean(zipDownload);
    const safeProgressPercent = Math.min(100, Math.max(0, progressPercent));

    const pdfDownloadLabel = pdfDownloads.length <= 1
        ? 'Download PDF'
        : `Download PDFs (${pdfDownloads.length})`;

    React.useEffect(() => {
        if (isProcessing || pdfDownloads.length <= 1)
            setIsPdfListOpen(false);
    }, [isProcessing, pdfDownloads.length, result]);

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur-sm">
            <div className="container mx-auto flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                    <button
                        onClick={onAction}
                        disabled={actionDisabled || isProcessing}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-500 px-8 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-red-600 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
                    >
                        {isProcessing ? (
                            <>
                                <Loader2 className="h-5 w-5 animate-spin" />
                                {progressLabel || `Processing... ${safeProgressPercent}%`}
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
                            className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-gray-300 bg-white px-4 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 sm:w-auto"
                        >
                            <X className="h-4 w-4" />
                            Cancel
                        </button>
                    )}
                </div>

                {isProcessing && (
                    <div className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2 sm:w-64">
                        <div className="mb-1 flex items-center justify-between text-xs font-medium text-gray-600">
                            <span>{progressLabel || 'Processing PDFs...'}</span>
                            <span>{safeProgressPercent}%</span>
                        </div>
                        <div className="h-2 overflow-hidden rounded-full bg-gray-200">
                            <div
                                className="h-full rounded-full bg-red-500 transition-all duration-300"
                                style={{ width: `${safeProgressPercent}%` }}
                            />
                        </div>
                    </div>
                )}

                {showDownloads && (
                    <div className="w-full sm:w-auto">
                        {hasBothDownloadOptions && (
                            <p className="mb-1 text-xs text-gray-500 sm:hidden">
                                Choose download format
                            </p>
                        )}

                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                            {pdfDownloads.length === 1 && (
                                <a
                                    href={pdfDownloads[0].url}
                                    download={pdfDownloads[0].filename}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-sky-700 hover:shadow-lg active:scale-[0.98] sm:w-auto"
                                >
                                    <Download className="h-5 w-5" />
                                    {pdfDownloadLabel}
                                </a>
                            )}

                            {pdfDownloads.length > 1 && (
                                <div className="w-full sm:w-auto">
                                    <button
                                        type="button"
                                        onClick={() => setIsPdfListOpen((prev) => !prev)}
                                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-sky-700 hover:shadow-lg active:scale-[0.98] sm:w-auto"
                                    >
                                        <Download className="h-5 w-5" />
                                        {isPdfListOpen ? 'Hide PDF list' : pdfDownloadLabel}
                                    </button>

                                    {isPdfListOpen && (
                                        <div className="mt-2 max-h-52 overflow-y-auto rounded-lg border border-gray-200 bg-white p-2 shadow-sm sm:absolute sm:bottom-16 sm:w-80">
                                            {pdfDownloads.map((file) => (
                                                <a
                                                    key={file.url}
                                                    href={file.url}
                                                    download={file.filename}
                                                    className="block rounded-md px-2 py-1.5 text-sm text-sky-700 transition hover:bg-sky-50"
                                                >
                                                    {file.filename}
                                                </a>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            )}

                            {zipDownload && (
                                <a
                                    href={zipDownload.url}
                                    download={zipDownload.filename}
                                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-green-700 hover:shadow-lg active:scale-[0.98] sm:w-auto"
                                >
                                    <Download className="h-5 w-5" />
                                    {hasBothDownloadOptions ? 'Download ZIP (single file)' : 'Download ZIP'}
                                </a>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default BottomActionBar;
