'use client';

import React, { useCallback, useState } from 'react'
import { useDropzone, FileRejection, DropEvent } from 'react-dropzone';
import { degrees, PDFDocument } from 'pdf-lib';
import { ArrowUpDown, Merge, Trash2, Download } from 'lucide-react';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    TouchSensor,
    useSensor,
    useSensors,
    DragEndEvent,
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    rectSortingStrategy
} from '@dnd-kit/sortable';


import { MAX_FILES, MAX_FILE_SIZE_MB } from '@/constants'
import FileCard from '@/components/single-use/filecard';
import { uuid } from '@/lib/utils';

const MergePDF = () => {
    const [pdfFiles, setPdfFiles] = useState<Array<FileMeta>>([]);
    const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isGeneratingPreviews, setIsGeneratingPreviews] = useState<boolean>(false);
    const [sortingOrder, setSortingOrder] = useState<boolean | null>(null); // note -> null = not sorted, true = ascending, false = descending

    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 150,
                tolerance: 5,
            },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (over && active.id !== over.id) {
            setPdfFiles((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
        }
    };

    const generatePreview = async (file: File): Promise<string> => {
        try {
            const pdfjsLib = await import('pdfjs-dist');

            if (typeof window !== 'undefined' && !pdfjsLib.GlobalWorkerOptions.workerSrc) {
                // pdfjsLib.GlobalWorkerOptions.workerSrc = `/pdf.worker.mjs`;

                // --- CDN version --- TESTING - IMP
                // https://cdn.jsdelivr.net/npm/pdfjs-dist@5.1.91/+esm
                const pdfjsVersion = '5.2.133';
                pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjsVersion}/build/pdf.worker.min.mjs`;
            }

            const arrayBuffer = await file.arrayBuffer();
            const pdfDoc = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            const page = await pdfDoc.getPage(1);

            const desiredWidth = 140;
            const viewport = page.getViewport({ scale: 1 });
            const scale = desiredWidth / viewport.width;
            const scaledViewport = page.getViewport({ scale });

            const canvas = document.createElement('canvas');
            const context = canvas.getContext('2d');
            if (!context) throw new Error('Could not get canvas context');

            canvas.height = scaledViewport.height;
            canvas.width = scaledViewport.width;

            const renderContext = {
                canvasContext: context,
                viewport: scaledViewport,
            };
            await page.render(renderContext).promise;

            pdfDoc.destroy();

            return canvas.toDataURL('image/png');
        } catch (error) {
            console.error(`Error generating preview for ${file.name}:`, error);
            return '/assets/placeholder-preview.svg';
        }
    };


    const onDrop = useCallback(async (acceptedFiles: File[], fileRejections: FileRejection[], event: DropEvent) => {
        setIsGeneratingPreviews(true);
        const newFilesPromises = acceptedFiles.map(async (file) => {
            try {
                const pdfLibDoc = await PDFDocument.load(await file.arrayBuffer());
                const pageCount = pdfLibDoc.getPageCount();
                const previewUrl = await generatePreview(file);

                return {
                    id: uuid(),
                    file,
                    name: file.name,
                    size: file.size,
                    pages: pageCount,
                    rotation: 0,
                    previewImageUrl: previewUrl,
                } as FileMeta;
            } catch (error) {
                console.error(`Failed to process file ${file.name}:`, error);
                alert(`Failed to process file ${file.name}. It might be corrupted or password-protected.`);
                return null;
            }
        });

        const newFiles = (await Promise.all(newFilesPromises)).filter(f => f !== null) as FileMeta[];

        setPdfFiles((prev) => {
            const combined = [...prev, ...newFiles];
            if (combined.length > MAX_FILES) {
                alert(`You can only upload up to ${MAX_FILES} files in total.`);
                return prev; // Or slice: combined.slice(0, MAX_FILES) - imp - review required
            }
            return combined;
        });
        setIsGeneratingPreviews(false);
    }, [pdfFiles]); // Remove pdfFiles from dependency array - it can cause unnecessary runs. Check if needed. - imp



    const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
        console.warn("Rejected files:", fileRejections);
        fileRejections.forEach(({ file, errors }) => {
            errors.forEach(({ code, message }) => {
                alert(`Error with ${file.name}: ${message}`);
            });
        });
    }, []);


    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: { 'application/pdf': ['.pdf'] },
        multiple: true,
        maxFiles: MAX_FILES,
        maxSize: MAX_FILE_SIZE_MB * 1024 * 1024,
        onDropRejected: onDropRejected,
        noClick: true,
        noKeyboard: true
    });

    const handleRotate = (id: string) => setPdfFiles((f) => f.map((p) => (p.id === id ? { ...p, rotation: (p.rotation + 90) % 360 } : p)));
    const handleRemoveFile = (id: string) => {
        const fileToRemove = pdfFiles.find(f => f.id === id);
        if (fileToRemove?.previewImageUrl.startsWith('blob:'))
            URL.revokeObjectURL(fileToRemove.previewImageUrl);

        setPdfFiles((f) => f.filter((p) => p.id !== id));
    }

    const handleClearFiles = () => {
        pdfFiles.forEach(f => {
            if (f.previewImageUrl.startsWith('blob:')) URL.revokeObjectURL(f.previewImageUrl);
        });
        setPdfFiles([]);
        setMergedPdfUrl(null);
    }

    const handleMergePdfs = async () => {
        if (pdfFiles.length < 2) {
            alert("You need at least two PDF files to merge.");
            return;
        }
        setIsLoading(true);
        setMergedPdfUrl(null);
        console.log("Starting merge for:", pdfFiles.map(f => f.name));

        try {
            const mergedPdf = await PDFDocument.create();

            for (const fileMeta of pdfFiles) {
                console.log(`Processing ${fileMeta.name}`);
                const pdfBytes = await fileMeta.file.arrayBuffer();
                const pdf = await PDFDocument.load(pdfBytes, {
                    ignoreEncryption: true, // <--- Ignore errors can be useful for problematic PDFs, but use with caution else getting error in UI while uploading
                });

                const indices = pdf.getPageIndices();
                const copiedPages = await mergedPdf.copyPages(pdf, indices);
                copiedPages.forEach((page) => {
                    if (fileMeta.rotation !== 0)
                        page.setRotation(degrees(fileMeta.rotation));

                    mergedPdf.addPage(page);
                });
            }

            const mergedPdfBytes = await mergedPdf.save();
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setMergedPdfUrl(url);

            // ------ Automatic Download ----- To be implemented later if required (imp)
            // const link = document.createElement('a');
            // link.href = url;
            // link.download = 'merged_document.pdf';
            // document.body.appendChild(link);
            // link.click();
            // document.body.removeChild(link);
            // // Optional: Revoke URL after a delay if not needed for display
            // // setTimeout(() => URL.revokeObjectURL(url), 1000);
        } catch (error) {
            console.error('Error merging PDFs:', error);
            alert(`An error occurred during merging: ${error instanceof Error ? error.message : String(error)}`);
            setMergedPdfUrl(null);
        } finally {
            setIsLoading(false);
        }
    };


    const handleSortByName = () => {
        if (pdfFiles.length < 2) {
            return;
        }

        const nextSortingOrder = sortingOrder === true ? false : true;

        const sortedFiles = [...pdfFiles].sort((a, b) => {
            const nameA = a.name.toLowerCase();
            const nameB = b.name.toLowerCase();
            if (nextSortingOrder === true) return nameA.localeCompare(nameB);
            else return nameB.localeCompare(nameA);
        });

        setSortingOrder(nextSortingOrder);
        setPdfFiles(sortedFiles);
    };

    return (
        <div {...getRootProps()} className={`relative min-h-screen select-none ${isDragActive ? 'border-4 border-dashed border-indigo-600' : ''}`}>
            <input {...getInputProps()} />

            <div
                className={`fixed inset-0 z-50 flex items-center justify-center bg-white/80 backdrop-blur-sm transition-opacity
        ${isDragActive ? 'opacity-100' : 'opacity-0 pointer-events-none'} `}
            >
                <div className="rounded-xl border-4 border-dashed border-indigo-600 bg-white p-10 text-2xl font-semibold text-indigo-700">
                    Yaay! Drop those PDFs here!
                </div>
            </div>
            <main className="container mx-auto flex flex-col items-center py-6">
                <h1 className="font-montserrat my-5 text-4xl">Merge PDF</h1>

                <div className='mb-4'>
                    <button
                        type="button"
                        onClick={open}
                        disabled={isGeneratingPreviews || isLoading}
                        className="mb-2 rounded-lg bg-indigo-600 px-5 py-3 text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer"
                    >
                        {isGeneratingPreviews ? 'Processing...' : 'Select PDF files'}
                    </button>
                    <p className='text-center text-[0.75rem] font-medium text-gray-500'>or drop PDFs here</p>
                </div>

                {!!pdfFiles.length && (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={pdfFiles.map(f => f.id)} strategy={rectSortingStrategy}>
                            <div className="mt-4 flex flex-wrap justify-center gap-4 touch-none">
                                {pdfFiles.map((f) => (
                                    <FileCard key={f.id} file={f} onRotate={handleRotate} onRemove={handleRemoveFile} />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                )}


                {pdfFiles.length > 0 && (
                    <div className="mt-10 flex flex-wrap justify-center gap-4">
                        <button
                            onClick={handleSortByName}
                            disabled={isLoading || isGeneratingPreviews}
                            className="rounded px-4 py-2 text-gray-400 hover:text-gray-800 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                        >
                            <ArrowUpDown className="h-5 w-5" />
                        </button>
                        <button
                            onClick={handleMergePdfs}
                            disabled={isLoading || isGeneratingPreviews || pdfFiles.length < 2}
                            className={`rounded px-4 py-2 text-green-600 hover:text-green-700 disabled:cursor-not-allowed disabled:opacity-50 cursor-pointer ${isLoading ? 'animate-pulse text-gray-800' : ''}`}
                        >
                            <Merge className="h-5 w-5" />
                        </button>
                        <button
                            onClick={handleClearFiles}
                            disabled={isLoading || isGeneratingPreviews}
                            className="rounded px-4 py-2 text-red-500 hover:text-red-600 disabled:opacity-50 cursor-pointer"
                        >
                            <Trash2 className="h-5 w-5" />
                        </button>

                        {mergedPdfUrl && (
                            <a
                                href={mergedPdfUrl}
                                download="merged_document.pdf"
                                className="rounded p-2 text-purple-600 hover:text-purple-700 disabled:opacity-50 cursor-pointer"
                            >
                                <Download className="h-5 w-5" />
                            </a>
                        )}
                    </div>
                )}
                {/* Optional - might nnot even be required - thorough review needed */}
                {/* <button
                            onClick={() => { if (mergedPdfUrl) URL.revokeObjectURL(mergedPdfUrl); setMergedPdfUrl(null); }}
                            className="ml-4 text-sm text-gray-500 hover:underline"
                        >
                            Dismiss
                        </button> */}
            </main>
        </div>
    )
}

export default MergePDF;


