import React from 'react';


const PdfProcessingLayout: React.FC<PdfProcessingLayoutProps> = ({
    title,
    dropzoneProps,
    processingState,
    fileLimits,
    children
}) => {
    const { getRootProps, getInputProps, open, isDragActive } = dropzoneProps;
    const { isLoading, isGeneratingPreviews } = processingState;
    const { maxFiles, maxFileSizeMB } = fileLimits;

    const buttonsDisabled = isLoading || isGeneratingPreviews;

    return (
        <div {...getRootProps()} className={`relative min-h-screen select-none ${isDragActive ? 'border-4 border-dashed border-indigo-600 bg-indigo-100/50' : ''}`}>
            <input {...getInputProps()} disabled={buttonsDisabled} />

            <div
                className={`pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm transition-opacity duration-300 ease-in-out
                 ${isDragActive ? 'opacity-100' : 'opacity-0'}`}
            >
                <div className="rounded-xl border-4 border-dashed border-indigo-600 bg-white p-10 text-2xl font-semibold text-indigo-700">
                    Drop PDF files anywhere!
                </div>
            </div>

            <main className="container mx-auto flex flex-col items-center px-4 py-6">
                <h1 className="font-montserrat mb-6 text-center text-3xl md:text-4xl font-semibold">{title}</h1>

                <div className='mb-6 text-center'>
                    <button
                        type="button"
                        onClick={() => open()}
                        onPointerDownCapture={(e) => e.stopPropagation()}
                        disabled={buttonsDisabled}
                        className="mb-2 rounded-lg bg-indigo-600 px-6 py-3 text-lg font-medium text-white shadow-md transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                        {isGeneratingPreviews ? 'Processing Files...' : isLoading ? 'Working...' : 'Select PDF Files'}
                    </button>
                    <p className='text-sm font-medium text-gray-500'>or drop PDFs anywhere on the page</p>
                    <p className='mt-1 text-xs text-gray-400'>Max {maxFiles} files, {maxFileSizeMB}MB per file.</p>
                </div>

                {isGeneratingPreviews && (
                    <div className="my-4 text-center text-indigo-600 animate-pulse">
                        Generating Previews...
                    </div>
                )}

                {children.fileDisplayArea}
                {children.actionButtonsArea}
                {children.noFilesPlaceholder}

            </main>
        </div>
    );
};

export default PdfProcessingLayout;