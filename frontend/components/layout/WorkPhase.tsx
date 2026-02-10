'use client';

import React, { useState } from 'react';
import { Plus, ArrowUpDown, SlidersHorizontal, Trash2, X } from 'lucide-react';
import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy } from '@dnd-kit/sortable';

import FileCard from '@/components/layout/filecard';
import type { FileMeta } from '@/hook/fileMeta';
import type { PdfDndSensors } from '@/hook/usePdfFiles';

interface WorkPhaseProps {
    files: FileMeta[];

    // File operations
    onRemoveFile: (id: string) => void;
    onRotate?: (id: string) => void;
    onClearFiles: () => void;
    onSortByName: () => void;
    sortingOrder: boolean | null;

    // Add more files
    onAddMore: () => void;
    isDisabled: boolean;
    isGeneratingPreviews: boolean;

    // DnD
    sensors: PdfDndSensors;
    handleDragEnd: (event: DragEndEvent) => void;

    // Optional sidebar
    sidebar?: React.ReactNode;

    // Optional custom renderer
    fileCardRenderer?: (file: FileMeta) => React.ReactNode;
}

const WorkPhase: React.FC<WorkPhaseProps> = ({
    files,
    onRemoveFile,
    onRotate,
    onClearFiles,
    onSortByName,
    sortingOrder,
    onAddMore,
    isDisabled,
    isGeneratingPreviews,
    sensors,
    handleDragEnd,
    sidebar,
    fileCardRenderer,
}) => {
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

    return (
        <div className="flex w-full flex-1 flex-col">
            <div className="flex items-center justify-between border-b bg-white px-4 py-3 md:px-6">
                <div className="flex items-center gap-2">
                    <button
                        onClick={onAddMore}
                        onPointerDownCapture={(e) => e.stopPropagation()}
                        disabled={isDisabled}
                        className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Plus className="h-4 w-4" />
                        Add more files
                    </button>

                    <span className="text-sm text-gray-400">
                        {files.length} file{files.length !== 1 ? 's' : ''}
                    </span>

                    {sidebar && (
                        <button
                            type="button"
                            onClick={() => setIsMobileSidebarOpen(true)}
                            onPointerDownCapture={(e) => e.stopPropagation()}
                            className="flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:bg-gray-50 lg:hidden"
                        >
                            <SlidersHorizontal className="h-4 w-4" />
                            Options
                        </button>
                    )}
                </div>

                <div className="flex items-center gap-1">
                    <button
                        title={sortingOrder === null ? 'Sort A-Z' : sortingOrder ? 'Sort Z-A' : 'Sort A-Z'}
                        onClick={onSortByName}
                        disabled={isDisabled}
                        className="flex items-center gap-1 rounded-md p-2 text-gray-400 transition hover:bg-gray-100 hover:text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <ArrowUpDown className="h-4 w-4" />
                    </button>

                    <button
                        title="Remove all files"
                        onClick={onClearFiles}
                        disabled={isDisabled}
                        className="flex items-center gap-1 rounded-md p-2 text-gray-400 transition hover:bg-red-50 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                        <Trash2 className="h-4 w-4" />
                    </button>
                </div>
            </div>

            {sidebar && (
                <div className={`fixed inset-0 z-50 lg:hidden ${isMobileSidebarOpen ? '' : 'pointer-events-none'}`}>
                    <button
                        type="button"
                        aria-label="Close options panel"
                        onClick={() => setIsMobileSidebarOpen(false)}
                        onPointerDownCapture={(e) => e.stopPropagation()}
                        className={`absolute inset-0 bg-black/40 transition-opacity ${isMobileSidebarOpen ? 'opacity-100' : 'opacity-0'}`}
                    />

                    <aside
                        onPointerDownCapture={(e) => e.stopPropagation()}
                        className={`absolute bottom-0 left-0 right-0 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl transition-transform duration-300 ${isMobileSidebarOpen ? 'translate-y-0' : 'translate-y-full'}`}
                    >
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-500">
                                Tool options
                            </h3>

                            <button
                                type="button"
                                aria-label="Close options panel"
                                onClick={() => setIsMobileSidebarOpen(false)}
                                onPointerDownCapture={(e) => e.stopPropagation()}
                                className="rounded-md p-2 text-gray-500 transition hover:bg-gray-100 hover:text-gray-700"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </div>

                        {sidebar}
                    </aside>
                </div>
            )}

            <div className="flex flex-1">
                <div className="flex-1 overflow-y-auto p-4 pb-24 md:p-6">
                    {isGeneratingPreviews && (
                        <div className="mb-4 animate-pulse text-center text-sm text-indigo-600">
                            Generating previews...
                        </div>
                    )}

                    <DndContext
                        sensors={sensors}
                        collisionDetection={closestCenter}
                        onDragEnd={handleDragEnd}
                    >
                        <SortableContext
                            items={files.map((f) => f.id)}
                            strategy={rectSortingStrategy}
                        >
                            <div className="grid touch-none grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 justify-items-center">
                                {files.map((f) =>
                                    fileCardRenderer ? (
                                        <React.Fragment key={f.id}>
                                            {fileCardRenderer(f)}
                                        </React.Fragment>
                                    ) : (
                                        <FileCard
                                            key={f.id}
                                            file={f}
                                            onRotate={onRotate}
                                            onRemove={onRemoveFile}
                                        />
                                    )
                                )}
                            </div>
                        </SortableContext>
                    </DndContext>
                </div>

                {sidebar && (
                    <aside className="hidden w-72 shrink-0 border-l bg-gray-50/50 p-5 lg:block">
                        {sidebar}
                    </aside>
                )}
            </div>
        </div>
    );
};

export default WorkPhase;
