'use client';

import React from 'react';
import { Download, Loader2 } from 'lucide-react';

export interface DownloadableResult {
    url: string;
    filename: string;
}

interface BottomActionBarProps {
    actionLabel: string;
    actionIcon?: React.ReactNode;
    onAction: () => void;
    actionDisabled?: boolean;
    isProcessing: boolean;
    resultUrl?: string | null;
    resultFilename?: string;
    resultFiles?: DownloadableResult[];
}

const BottomActionBar: React.FC<BottomActionBarProps> = ({
    actionLabel,
    actionIcon,
    onAction,
    actionDisabled,
    isProcessing,
    resultUrl,
    resultFilename = 'output.pdf',
    resultFiles,
}) => {
    const downloads = resultFiles && resultFiles.length > 0
        ? resultFiles
        : resultUrl
            ? [{ url: resultUrl, filename: resultFilename }]
            : [];

    const handleDownloadAll = () => {
        downloads.forEach((file) => {
            const link = document.createElement('a');
            link.href = file.url;
            link.download = file.filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });
    };

    return (
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-white/95 backdrop-blur-sm">
            <div className="container mx-auto flex items-center justify-center gap-4 px-4 py-3">
                {/* Primary action */}
                <button
                    onClick={onAction}
                    disabled={actionDisabled || isProcessing}
                    className="flex items-center gap-2 rounded-xl bg-red-500 px-8 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-red-600 hover:shadow-lg active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
                >
                    {isProcessing ? (
                        <>
                            <Loader2 className="h-5 w-5 animate-spin" />
                            Processing...
                        </>
                    ) : (
                        <>
                            {actionIcon}
                            {actionLabel}
                        </>
                    )}
                </button>

                {/* Download button(s) (appear after processing) */}
                {downloads.length === 1 && !isProcessing && (
                    <a
                        href={downloads[0].url}
                        download={downloads[0].filename}
                        className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-green-700 hover:shadow-lg active:scale-[0.98]"
                    >
                        <Download className="h-5 w-5" />
                        Download
                    </a>
                )}

                {downloads.length > 1 && !isProcessing && (
                    <button
                        type="button"
                        onClick={handleDownloadAll}
                        className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-green-700 hover:shadow-lg active:scale-[0.98]"
                    >
                        <Download className="h-5 w-5" />
                        Download All ({downloads.length})
                    </button>
                )}
            </div>
        </div>
    );
};

export default BottomActionBar;
