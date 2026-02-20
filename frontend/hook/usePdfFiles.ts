'use client';
import { useCallback, useState, useMemo, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import { useDropzone, FileRejection, type DropzoneState } from 'react-dropzone';
import {
    KeyboardSensor, PointerSensor,
    TouchSensor, useSensor, useSensors, DragEndEvent
} from '@dnd-kit/core';
import {
    arrayMove, sortableKeyboardCoordinates
} from '@dnd-kit/sortable';

import { MAX_FILES, MAX_FILE_SIZE_MB } from '@/constants';
import { FileMetaSchema, type FileMeta } from '@/hook/fileMeta';
import { generatePdfPreview, cleanupPdfPreviewWorker } from '@/service/pdfPreviewService';
import { debounce, uuid } from '@/lib/utils';

export interface UsePdfFilesOptions {
    maxFiles?: number;
    maxFileSizeMB?: number;
}

export type PdfDropzone = Pick<
    DropzoneState,
    'getRootProps' | 'getInputProps' | 'open' | 'isDragActive'
>;

export type PdfDndSensors = ReturnType<typeof useSensors>;

export function usePdfFiles(options?: UsePdfFilesOptions) {
    const maxFiles = options?.maxFiles ?? MAX_FILES;
    const maxFileSizeMB = options?.maxFileSizeMB ?? MAX_FILE_SIZE_MB;

    const [pdfFiles, setPdfFiles] = useState<Array<FileMeta>>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isGeneratingPreviews, setIsGeneratingPreviews] = useState(false);
    const [sortingOrder, setSortingOrder] = useState<boolean | null>(null);

    useEffect(() => {
        return () => { cleanupPdfPreviewWorker(); };
    }, []);

    // ── DnD sensors ──────────────────────────────────────────────────────
    const sensors = useSensors(
        useSensor(PointerSensor, {
            activationConstraint: { distance: 5 },
        }),
        useSensor(TouchSensor, {
            activationConstraint: { delay: 150, tolerance: 5 },
        }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        })
    );

    // ── Drag end ─────────────────────────────────────────────────────────
    const handleDragEnd = useCallback((event: DragEndEvent) => {
        const { active, over } = event;
        if (over && active.id !== over.id) {
            setPdfFiles((items) => {
                const oldIndex = items.findIndex((item) => item.id === active.id);
                const newIndex = items.findIndex((item) => item.id === over.id);
                return arrayMove(items, oldIndex, newIndex);
            });
            setSortingOrder(null);
        }
    }, []);

    // ── Add files (shared across all tools) ──────────────────────────────
    const addFiles = useCallback(
        async (files: File[]) => {
            if (!files || files.length === 0) return;

            if (pdfFiles.length + files.length > maxFiles) {
                toast.error(
                    `You can only add ${maxFiles} files in total. Please remove some files first.`
                );
                files = files.slice(0, maxFiles - pdfFiles.length);
                if (files.length === 0) return;
                return;
            }

            setIsGeneratingPreviews(true);
            const { PDFDocument } = await import('pdf-lib');
            const newMetas: FileMeta[] = [];

            for (const file of files) {
                try {
                    let pdfDoc;
                    try {
                        const buffer = await file.arrayBuffer();
                        pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
                    } catch (err) {
                        console.error(`Failed loading PDF ${file.name}:`, err);
                        toast.error(`Couldn't load ${file.name}. Is it a valid PDF?`);
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
                        toast.error(`Could not generate thumbnail for ${file.name}, using placeholder.`);
                        previewUrl = '/assets/placeholder-preview.svg';
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
                    newMetas.push({ ...validatedMeta, id: uuid(), file });
                } catch (err) {
                    console.log(`Failed to process ${file.name}:`, err);
                    toast.error(`Failed processing ${file.name}. Try re-uploading.`);
                    continue;
                }
            }

            setPdfFiles((prev) => [...prev, ...newMetas].slice(0, maxFiles));
            setIsGeneratingPreviews(false);
        },
        [pdfFiles, maxFiles]
    );

    // ── Drop rejection handler ───────────────────────────────────────────
    const onDropRejected = useCallback(
        (fileRejections: FileRejection[]) => {
            console.warn('Rejected files:', fileRejections);
            fileRejections.forEach(({ file, errors }) => {
                errors.forEach(({ code, message }) => {
                    let userMessage = message;
                    if (code === 'file-too-large')
                        userMessage = `${file.name} is too large. Maximum size is ${maxFileSizeMB}MB.`;
                    else if (code === 'too-many-files')
                        userMessage = `Cannot add ${file.name}. Maximum number of files (${maxFiles}) reached.`;
                    else if (code === 'file-invalid-type')
                        userMessage = `${file.name} is not a valid PDF file.`;
                    toast.error(userMessage);
                });
            });
        },
        [maxFiles, maxFileSizeMB]
    );

    // ── Dropzone config ──────────────────────────────────────────────────
    const dropzone = useDropzone({
        onDrop: addFiles,
        accept: { 'application/pdf': ['.pdf'] },
        multiple: true,
        maxFiles,
        maxSize: maxFileSizeMB * 1024 * 1024,
        onDropRejected,
        noClick: true,
        noKeyboard: true,
        disabled: isLoading || isGeneratingPreviews,
    });

    // ── Rotate ───────────────────────────────────────────────────────────
    const handleRotate = useMemo(
        () =>
            debounce((id: string) => {
                setPdfFiles((prev) =>
                    prev.map((f) =>
                        f.id === id ? { ...f, rotation: (f.rotation + 90) % 360 } : f
                    )
                );
            }, 150),
        []
    );

    // ── Remove single file ───────────────────────────────────────────────
    const handleRemoveFile = useCallback((id: string) => {
        setPdfFiles((prevFiles) => {
            const fileToRemove = prevFiles.find((f) => f.id === id);
            if (fileToRemove?.previewImageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(fileToRemove.previewImageUrl);
            }
            return prevFiles.filter((p) => p.id !== id);
        });
        setSortingOrder(null);
    }, []);

    // ── Clear all files ──────────────────────────────────────────────────
    const handleClearFiles = useCallback(() => {
        pdfFiles.forEach((f) => {
            if (f.previewImageUrl.startsWith('blob:')) {
                URL.revokeObjectURL(f.previewImageUrl);
            }
        });
        setPdfFiles([]);
        setSortingOrder(null);
    }, [pdfFiles]);

    // ── Sort by name ─────────────────────────────────────────────────────
    const handleSortByName = useMemo(
        () =>
            debounce(() => {
                setPdfFiles((prev) => {
                    const nextOrder = !sortingOrder;
                    setSortingOrder(nextOrder);
                    return [...prev].sort((a, b) =>
                        nextOrder
                            ? a.name.localeCompare(b.name)
                            : b.name.localeCompare(a.name)
                    );
                });
            }, 200),
        [sortingOrder]
    );

    const buttonsDisabled = isLoading || isGeneratingPreviews;

    return {
        // State
        pdfFiles,
        setPdfFiles,
        isLoading,
        setIsLoading,
        isGeneratingPreviews,
        sortingOrder,

        // DnD
        sensors,
        handleDragEnd,

        // Dropzone (spread-ready)
        dropzone,

        // File operations
        handleRotate,
        handleRemoveFile,
        handleClearFiles,
        handleSortByName,

        // Derived
        buttonsDisabled,
        fileLimits: { maxFiles, maxFileSizeMB },
    };
}
