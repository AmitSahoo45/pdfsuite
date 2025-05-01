'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useDropzone, FileRejection } from 'react-dropzone';
import { degrees, PDFDocument } from 'pdf-lib';
import { ArrowUpDown, Merge, Trash2, Download } from 'lucide-react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, rectSortingStrategy } from '@dnd-kit/sortable';
import toast from 'react-hot-toast';

import { MAX_FILES, MAX_FILE_SIZE_MB } from '@/constants';
import FileCard from '@/components/layout/filecard';
import { debounce, uuid } from '@/lib/utils';
import { FileMeta, FileMetaSchema } from '@/hook/useMergePdf';
import { generatePdfPreview, cleanupPdfPreviewWorker } from '@/service/pdfPreviewService';
import PdfProcessingLayout from '@/components/layout/PdfProcessingLayout';



const MergePDF = () => {
    const [pdfFiles, setPdfFiles] = useState<Array<FileMeta>>([]);
    const [mergedPdfUrl, setMergedPdfUrl] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isGeneratingPreviews, setIsGeneratingPreviews] = useState<boolean>(false);
    const [sortingOrder, setSortingOrder] = useState<boolean | null>(null);

    useEffect(() => { return () => { cleanupPdfPreviewWorker() } }, []);

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

            setSortingOrder(null);
        }
    };

    const onDropRejected = useCallback((fileRejections: FileRejection[]) => {
        console.warn("Rejected files:", fileRejections);
        fileRejections.forEach(({ file, errors }) => {
            errors.forEach(({ code, message }) => {
                let userMessage = message;
                if (code === 'file-too-large')
                    userMessage = `${file.name} is too large. Maximum size is ${MAX_FILE_SIZE_MB}MB.`;
                else if (code === 'too-many-files')
                    // This might trigger multiple times, consider a single toast/alert. Todo  :::::: 
                    userMessage = `Cannot add ${file.name}. Maximum number of files (${MAX_FILES}) reached.`;
                else if (code === 'file-invalid-type')
                    userMessage = `${file.name} is not a valid PDF file.`;

                toast.error(userMessage);
            });
        });
    }, []);

    const addFiles = useCallback(
        async (files: File[]) => {
            if (!files || files.length === 0) return;

            if (pdfFiles.length + files.length > MAX_FILES) {
                toast.error(`You can only add ${MAX_FILES} files in total. Please remove some files first.`);

                // Optionally slice the acceptedFiles array to only add allowed number
                files = files.slice(0, MAX_FILES - pdfFiles.length);
                if (files.length === 0) return; // Stop if no files can be added
                return; // Stop processing if limit is exceeded by the drop
            }

            setIsGeneratingPreviews(true);
            const { PDFDocument } = await import('pdf-lib');
            const newMetas: FileMeta[] = [];

            for (const file of files) {
                try {
                    const previewUrlPromise = generatePdfPreview(file);
                    const fileBuffer = await file.arrayBuffer();
                    const pdfDocPromise = PDFDocument.load(fileBuffer, { ignoreEncryption: true });

                    const [previewUrl, pdfDoc] = await Promise.all([previewUrlPromise, pdfDocPromise]);

                    const pages = pdfDoc.getPageCount();
                    if (pages === 0) {
                        toast.error(`${file.name} has no pages and cannot be processed.`);

                        if (previewUrl.startsWith('blob:'))
                            URL.revokeObjectURL(previewUrl);

                        return null;
                    }


                    const meta: Omit<FileMeta, 'id'> = {
                        file,
                        name: file.name,
                        size: file.size,
                        pages,
                        rotation: 0,
                        previewImageUrl: previewUrl,
                    };
                    const validatedMeta = FileMetaSchema.omit({ id: true }).parse(meta);
                    newMetas.push({ ...validatedMeta, id: uuid(), file: file });
                } catch (err) {
                    console.log(`Failed to process ${file.name}:`, err);
                    toast.error(`Failed processing ${file.name}. Try re-uploading.`);
                    continue;
                }
            }

            setPdfFiles(prev => [...prev, ...newMetas].slice(0, MAX_FILES));
            setIsGeneratingPreviews(false);
        },
        [pdfFiles]
    );


    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop: addFiles,
        accept: { 'application/pdf': ['.pdf'] },
        multiple: true,
        maxFiles: MAX_FILES,
        maxSize: MAX_FILE_SIZE_MB * 1024 * 1024,
        onDropRejected: onDropRejected,
        noClick: true,
        noKeyboard: true,
        disabled: isLoading || isGeneratingPreviews,
    });

    const handleRotate = useMemo(
        () =>
            debounce((id: string) => {
                setPdfFiles(prev =>
                    prev.map(f => (f.id === id ? { ...f, rotation: (f.rotation + 90) % 360 } : f))
                );
            }, 150),
        []
    );

    const handleRemoveFile = useCallback((id: string) => {
        setPdfFiles((prevFiles) => {
            const fileToRemove = prevFiles.find(f => f.id === id);
            if (fileToRemove?.previewImageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(fileToRemove.previewImageUrl);
            }
            return prevFiles.filter((p) => p.id !== id);
        });

        setSortingOrder(null);
    }, []);

    const handleClearFiles = useCallback(() => {
        pdfFiles.forEach(f => {
            if (f.previewImageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(f.previewImageUrl);
            }
        });
        setPdfFiles([]);
        setMergedPdfUrl(null);
        setSortingOrder(null);
    }, [pdfFiles]);

    const handleMergePdfs = useCallback(async () => {
        if (pdfFiles.length < 2) {
            toast.error("You need at least two PDF files to merge.");
            return;
        }
        setIsLoading(true);

        if (mergedPdfUrl && mergedPdfUrl.startsWith('blob:'))
            URL.revokeObjectURL(mergedPdfUrl);

        setMergedPdfUrl(null);

        try {
            const mergedPdf = await PDFDocument.create();

            for (const fileMeta of pdfFiles) {
                try {
                    const pdfBytes = await fileMeta.file.arrayBuffer();

                    const pdf = await PDFDocument.load(pdfBytes, { ignoreEncryption: true });

                    const indices = pdf.getPageIndices();
                    if (indices.length === 0)
                        continue;

                    const copiedPages = await mergedPdf.copyPages(pdf, indices);
                    copiedPages.forEach((page) => {
                        const originalRotation = page.getRotation().angle;
                        page.setRotation(degrees((originalRotation + fileMeta.rotation) % 360));
                        mergedPdf.addPage(page);
                    });
                } catch (loadError) {
                    console.log(`Error loading or copying pages from ${fileMeta.name}:`, loadError);
                    toast.error(`Skipping ${fileMeta.name} due to an error during processing.`);
                }
            }

            if (mergedPdf.getPageCount() === 0)
                throw new Error("No pages could be added to the merged document. Check input files.");

            const mergedPdfBytes = await mergedPdf.save();
            const blob = new Blob([mergedPdfBytes], { type: 'application/pdf' });
            const url = URL.createObjectURL(blob);
            setMergedPdfUrl(url);
            toast.success("PDFs merged successfully!");

            // Optional: Trigger automatic download (consider UX implications)
            // const link = document.createElement('a');
            // link.href = url;
            // link.download = 'merged_document.pdf';
            // document.body.appendChild(link);
            // link.click();
            // document.body.removeChild(link);
            // // Don't revoke URL immediately if displaying download button
        } catch (error) {
            console.error('Error merging PDFs:', error);
            toast.error(`Merge failed: ${error instanceof Error ? error.message : String(error)}`);
            setMergedPdfUrl(null);
        } finally {
            setIsLoading(false);
        }
    }, [pdfFiles, mergedPdfUrl]);

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

    const buttonsDisabled = isLoading || isGeneratingPreviews;
    const mergeDisabled = buttonsDisabled || pdfFiles.length < 2;

    const layoutDropzoneProps = { getRootProps, getInputProps, open, isDragActive };
    const layoutProcessingState = { isLoading, isGeneratingPreviews };
    const layoutFileLimits = { maxFiles: MAX_FILES, maxFileSizeMB: MAX_FILE_SIZE_MB };

    return (
        <PdfProcessingLayout
            title="Merge PDF Files"
            dropzoneProps={layoutDropzoneProps}
            processingState={layoutProcessingState}
            fileLimits={layoutFileLimits}
        >
            {{ 
                // Pass JSX elements for the named slots
                fileDisplayArea: pdfFiles.length > 0 && (
                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext items={pdfFiles.map(f => f.id)} strategy={rectSortingStrategy}>
                            <div className="mb-8 mt-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 justify-center gap-4 touch-none px-2">
                                {pdfFiles.map((f) => (
                                    <FileCard key={f.id} file={f} onRotate={handleRotate} onRemove={handleRemoveFile} />
                                ))}
                            </div>
                        </SortableContext>
                    </DndContext>
                ),

                actionButtonsArea: pdfFiles.length > 0 && (
                    <div className="mt-6 flex flex-wrap items-center justify-center gap-3 rounded-lg bg-gray-50 p-4 shadow-sm border">
                        <button
                            title={sortingOrder === null ? "Sort A-Z" : sortingOrder ? "Sort Z-A" : "Sort A-Z"}
                            onClick={handleSortByName}
                            disabled={isLoading || isGeneratingPreviews} 
                            className="flex items-center gap-1 rounded-md p-2 text-gray-500 transition hover:bg-gray-200 hover:text-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <ArrowUpDown className="h-5 w-5" />
                            <span className="text-sm font-medium">Sort</span>
                        </button>

                        <button
                            title={pdfFiles.length < 2 ? "Need at least 2 files" : "Merge all PDFs"}
                            onClick={handleMergePdfs}
                            disabled={mergeDisabled} 
                            className={`flex items-center gap-1 rounded-md p-2 text-green-600 transition hover:bg-green-100 hover:text-green-700 disabled:cursor-not-allowed disabled:text-gray-400 disabled:hover:bg-transparent ${isLoading ? 'animate-pulse text-green-700' : ''}`}
                        >
                            <Merge className="h-5 w-5" />
                            <span className="text-sm font-medium">{isLoading ? 'Merging...' : 'Merge'}</span>
                        </button>

                        <button
                            title="Remove all files"
                            onClick={handleClearFiles}
                            disabled={isLoading || isGeneratingPreviews}
                            className="flex items-center gap-1 rounded-md p-2 text-red-500 transition hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Trash2 className="h-5 w-5" />
                            <span className="text-sm font-medium">Clear</span>
                        </button>

                        {mergedPdfUrl && !isLoading && (
                            <a
                                href={mergedPdfUrl}
                                download="merged_document.pdf"
                                title="Download Merged PDF"
                                className="ml-2 flex items-center gap-1 rounded-md bg-purple-600 px-3 py-2 text-white shadow transition hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:ring-offset-2"
                            >
                                <Download className="h-5 w-5" />
                                <span className="text-sm font-medium">Download</span>
                            </a>
                        )}
                    </div>
                ),

                noFilesPlaceholder: pdfFiles.length === 0 && !isGeneratingPreviews && (
                    <div className="mt-10 text-center text-gray-500">
                        <p>Add some PDF files to get started!</p>
                    </div>
                )
            }}
        </PdfProcessingLayout>
    );
}

export default MergePDF;