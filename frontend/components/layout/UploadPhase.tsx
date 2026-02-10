'use client';

import React from 'react';
import { Upload } from 'lucide-react';

interface UploadPhaseProps {
    title: string;
    description: string;
    onSelectFiles: () => void;
    isDisabled: boolean;
    maxFiles: number;
    maxFileSizeMB: number;
}

const UploadPhase: React.FC<UploadPhaseProps> = ({
    title,
    description,
    onSelectFiles,
    isDisabled,
    maxFiles,
    maxFileSizeMB,
}) => {
    return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center px-4">
            <div className="w-full max-w-xl text-center">
                <h1 className="font-montserrat mb-3 text-4xl font-bold md:text-5xl">
                    {title}
                </h1>
                <p className="mb-8 text-base text-gray-500 md:text-lg">
                    {description}
                </p>

                <button
                    type="button"
                    onClick={onSelectFiles}
                    onPointerDownCapture={(e) => e.stopPropagation()}
                    disabled={isDisabled}
                    className="mx-auto flex items-center gap-3 rounded-xl bg-red-500 px-12 py-4 text-lg font-semibold text-white shadow-lg transition-all hover:bg-red-600 hover:shadow-xl active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
                >
                    <Upload className="h-5 w-5" />
                    Select PDF file
                </button>

                <p className="mt-4 text-sm text-gray-400">
                    or drop PDF here
                </p>
                <p className="mt-1 text-xs text-gray-300">
                    Max {maxFiles} files, {maxFileSizeMB}MB per file
                </p>
            </div>
        </div>
    );
};

export default UploadPhase;