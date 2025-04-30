'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { useDropzone, FileRejection } from 'react-dropzone';
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
import { debounce, uuid } from '@/lib/utils';
import { FileMeta, FileMetaSchema } from '@/hook/useMergePdf';
import toast from 'react-hot-toast';

const MergePDF = () => {
    const [pdfFiles, setPdfFiles] = useState<Array<FileMeta>>([]);
    const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isGeneratingPreviews, setIsGeneratingPreviews] = useState<boolean>(false);
    const [sortingOrder, setSortingOrder] = useState<boolean | null>(null); // note -> null = not sorted, true = ascending, false = descending
    const [worker, setWorker] = useState<Worker | null>(null);

    useEffect(() => {
        const w = new Worker(new URL('../../worker/preview.worker.ts', import.meta.url), { type: 'module' });
        setWorker(w);

        w.onerror = (err) => {
            console.error('Worker error:', err);
            toast.error('Oops! Please reload the page and try again.');
        };

        return () => {
            w.terminate();
        };
    }, []);

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

    const generatePreview = useCallback(
        (file: File): Promise<string> => {
            if (!worker)
                return Promise.reject(new Error('Worker not initialized'));

            return new Promise((resolve, reject) => {
                worker.onmessage = (e) => resolve(e.data as string);
                worker.onerror = (err) => reject(err);
                file
                    .arrayBuffer()
                    .then((buffer) => worker.postMessage(buffer, [buffer]));
            });
        },
        [worker]
    );

    const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
        console.warn("Rejected files:", fileRejections);
        fileRejections.forEach(({ file, errors }) => {
            errors.forEach(({ message }) => {
                alert(`Error with ${file.name}: ${message}`);
            });
        });
    }, []);

    const addFiles = useCallback(
        async (files: File[]) => {
            setIsGeneratingPreviews(true);
            const { PDFDocument } = await import('pdf-lib');
            const newMetas: FileMeta[] = [];
            for (const file of files) {
                try {
                    const arr = await file.arrayBuffer();
                    const pdfDoc = await PDFDocument.load(arr);
                    const pages = pdfDoc.getPageCount();
                    const rawPreview = await generatePreview(file);

                    let previewUrl: string;
                    if (typeof rawPreview === 'string') {
                        previewUrl = rawPreview;
                    } else if ((rawPreview as unknown) instanceof Blob) {
                        previewUrl = URL.createObjectURL(rawPreview as Blob);
                    } else {
                        previewUrl = '/assets/placeholder-preview.svg';
                    }

                    const meta = {
                        id: crypto.randomUUID(),
                        file,
                        name: file.name,
                        size: file.size,
                        pages,
                        rotation: 0,
                        previewImageUrl: previewUrl,   
                    };

                    newMetas.push(FileMetaSchema.parse(meta));
                } catch (err) {
                    console.error(err);
                    toast.error(`Failed to process ${file.name}`);
                }
            }

            setPdfFiles(prev => [...prev, ...newMetas]);
            setIsGeneratingPreviews(false);
        },
        [generatePreview]
    );

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop: addFiles,
        accept: { 'application/pdf': ['.pdf'] },
        multiple: true,
        maxFiles: MAX_FILES,
        maxSize: MAX_FILE_SIZE_MB * 1024 * 1024,
        onDropRejected: onDropRejected,
        noClick: true,
        noKeyboard: true
    });

    const handleRotate = useMemo(
        () =>
            debounce((id: string) => {
                setPdfFiles(prev =>
                    prev.map(f => (f.id === id ? { ...f, rotation: (f.rotation + 90) % 360 } : f))
                );
            }, 200),
        []
    );

    const handleRemoveFile = useCallback((id: string) => {
        const fileToRemove = pdfFiles.find(f => f.id === id);
        if (fileToRemove?.previewImageUrl.startsWith('blob:'))
            URL.revokeObjectURL(fileToRemove.previewImageUrl);

        setPdfFiles((f) => f.filter((p) => p.id !== id));
    }, [pdfFiles]);

    const handleClearFiles = useCallback(() => {
        pdfFiles.forEach(f => {
            if (f.previewImageUrl.startsWith('blob:')) URL.revokeObjectURL(f.previewImageUrl);
        });
        setPdfFiles([]);
        setMergedPdfUrl(null);
    }, [pdfFiles]);

    const handleMergePdfs = useCallback(async () => {
        if (pdfFiles.length < 2) {
            alert("You need at least two PDF files to merge.");
            return;
        }
        setIsLoading(true);
        setMergedPdfUrl(null);

        try {
            const mergedPdf = await PDFDocument.create();

            for (const fileMeta of pdfFiles) {
                const pdfBytes = await fileMeta.file.arrayBuffer();
                const pdf = await PDFDocument.load(pdfBytes, {
                    ignoreEncryption: true, // <--- Ignore errors can be useful for problematic PDFs
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
    }, [pdfFiles]);

    const handleSortByName = useMemo(
        () =>
            debounce(() => {
                setPdfFiles(prev => {
                    const nextOrder = !sortingOrder;
                    setSortingOrder(nextOrder);
                    return [...prev].sort((a, b) =>
                        nextOrder ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
                    );
                });
            }, 200),
        [sortingOrder]
    );

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
    );
}

export default MergePDF;


