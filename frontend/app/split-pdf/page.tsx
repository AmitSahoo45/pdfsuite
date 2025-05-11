'use client';

import React, { useCallback, useMemo, useState } from 'react'
import { FileRejection, useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { ArrowUpDown, Trash2 } from 'lucide-react';
import { closestCenter, DndContext, DragEndEvent, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, rectSortingStrategy, SortableContext, sortableKeyboardCoordinates } from '@dnd-kit/sortable';

import { MAX_FILE_SIZE_MB, MAX_FILES } from '@/constants';
import PdfProcessingLayout from '@/components/layout/PdfProcessingLayout'
import { generatePdfPreview } from '@/service/pdfPreviewService';
import { FileMetaSchema } from '@/hook/useMergePdf';
import { debounce, uuid } from '@/lib/utils';
import FileCard from '@/components/layout/filecard';


const page = () => {
    const [pdfFiles, setPdfFiles] = useState<Array<FileMeta>>([]);
    const [isGeneratingPreviews, setIsGeneratingPreviews] = useState<boolean>(false);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [sortingOrder, setSortingOrder] = useState<boolean | null>(null);

    // #region File operations
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
    // #endregion

    // #region Dropzone functions
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
                    // fix for failed preview - 
                    let pdfDoc;
                    try {
                        const buffer = await file.arrayBuffer();
                        pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
                    } catch (err) {
                        console.error(`Failed loading PDF ${file.name}:`, err);
                        toast.error(`Couldn’t load ${file.name}. Is it a valid PDF?`);
                        continue;
                    }


                    const pages = pdfDoc.getPageCount();
                    if (pages === 0) {
                        toast.error(`${file.name} has no pages. Skipping.`);
                        continue;
                    }

                    let previewUrl: string;
                    try {
                        previewUrl = await generatePdfPreview(file);
                    } catch (err) {
                        console.error(`Preview failed for ${file.name}:`, err);
                        toast.error(`Failed generating preview for ${file.name}.`);
                        continue;
                    }



                    // fix for Failed to load PDF document error : starts here
                    const meta: Omit<FileMeta, 'id'> = {
                        file,
                        name: file.name,
                        size: file.size,
                        pages,
                        rotation: 0,
                        previewImageUrl: previewUrl,
                    };
                    const validatedMeta = FileMetaSchema.omit({ id: true }).parse(meta);
                    newMetas.push({ ...validatedMeta, id: uuid(), file });
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
    //#endregion

    //#region Dropzone 
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
    //#endregion

    // #region Methods 
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

    const handleClearFiles = useCallback(() => {
        pdfFiles.forEach(f => {
            if (f.previewImageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(f.previewImageUrl);
            }
        });
        setPdfFiles([]);
        setSortingOrder(null);
    }, [pdfFiles]);
    // #endregion

    const layoutDropzoneProps = { getRootProps, getInputProps, open, isDragActive };
    const layoutProcessingState = { isLoading, isGeneratingPreviews };
    const layoutFileLimits = { maxFiles: MAX_FILES, maxFileSizeMB: MAX_FILE_SIZE_MB };
    return (
        <PdfProcessingLayout
            title='Split PDF'
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
                                    <FileCard key={f.id} file={f} onRemove={handleRemoveFile} />
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
                            title="Remove all files"
                            onClick={handleClearFiles}
                            disabled={isLoading || isGeneratingPreviews}
                            className="flex items-center gap-1 rounded-md p-2 text-red-500 transition hover:bg-red-100 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                            <Trash2 className="h-5 w-5" />
                            <span className="text-sm font-medium">Clear</span>
                        </button>
                    </div>
                ),

                noFilesPlaceholder: pdfFiles.length === 0 && !isGeneratingPreviews && (
                    <div className="mt-10 text-center text-gray-500">
                        <p>Add some PDF files to get started!</p>
                    </div>
                )
            }}
        </PdfProcessingLayout>
    )
}

export default page