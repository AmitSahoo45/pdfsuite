'use client';

import React from 'react';
import { Download, Loader2 } from 'lucide-react';

interface BottomActionBarProps {
    actionLabel: string;
    actionIcon?: React.ReactNode;
    onAction: () => void;
    actionDisabled?: boolean;
    isProcessing: boolean;
    resultUrl?: string | null;
    resultFilename?: string;
}

const BottomActionBar: React.FC<BottomActionBarProps> = ({
    actionLabel,
    actionIcon,
    onAction,
    actionDisabled,
    isProcessing,
    resultUrl,
    resultFilename = 'output.pdf',
}) => {
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

                {/* Download button (appears after processing) */}
                {resultUrl && !isProcessing && (
                    <a
                        href={resultUrl}
                        download={resultFilename}
                        className="flex items-center gap-2 rounded-xl bg-green-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-green-700 hover:shadow-lg active:scale-[0.98]"
                    >
                        <Download className="h-5 w-5" />
                        Download
                    </a>
                )}
            </div>
        </div>
    );
};

export default BottomActionBar;