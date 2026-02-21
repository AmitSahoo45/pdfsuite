'use client';

import React from 'react';
import { Archive, FileText } from 'lucide-react';

import { formatByteSize } from '@/lib/toolSummary';
import type { ToolSummary } from '@/types/toolResult';

interface ResultSummaryPanelProps {
    summary: ToolSummary;
    isProcessing?: boolean;
}

const ResultSummaryPanel: React.FC<ResultSummaryPanelProps> = ({
    summary,
    isProcessing = false,
}) => {
    const phaseLabel = isProcessing
        ? 'Processing'
        : summary.phase === 'completed'
            ? 'After processing'
            : 'Before processing';

    const totalSizeLabel = summary.totalSizeBytes === null
        ? formatByteSize(null)
        : `${summary.isEstimatedSize ? '~' : ''}${formatByteSize(summary.totalSizeBytes)}`;

    return (
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-semibold uppercase tracking-wide text-gray-600">
                    Result summary
                </h3>
                <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700">
                    {phaseLabel}
                </span>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Mode used</p>
                    <p className="mt-1 font-medium text-gray-800">{summary.modeLabel}</p>
                </div>
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Output count</p>
                    <p className="mt-1 font-medium text-gray-800">{summary.outputCount} PDF{summary.outputCount !== 1 ? 's' : ''}</p>
                </div>
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Total size</p>
                    <p className="mt-1 font-medium text-gray-800">{totalSizeLabel}</p>
                </div>
                <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">ZIP option</p>
                    <p className="mt-1 font-medium text-gray-800">
                        {summary.zipAvailable ? 'Available' : 'Not available'}
                    </p>
                    {summary.zipAvailable && summary.zipName && (
                        <p className="mt-1 truncate text-xs text-gray-500">
                            {summary.zipName}
                            {summary.zipSizeBytes
                                ? ` (${formatByteSize(summary.zipSizeBytes)})`
                                : ''}
                        </p>
                    )}
                </div>
            </div>

            {summary.note && (
                <p className="mt-3 rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-800">
                    {summary.note}
                </p>
            )}

            <div className="mt-3">
                <p className="text-xs uppercase tracking-wide text-gray-500">Output names</p>
                {summary.outputNames.length === 0 ? (
                    <p className="mt-2 text-sm text-gray-500">No output names yet.</p>
                ) : (
                    <ul className="mt-2 space-y-1">
                        {summary.outputNames.map((name, index) => (
                            <li key={`${name}-${index}`} className="flex items-center gap-2 text-sm text-gray-700">
                                <FileText className="h-4 w-4 text-gray-400" />
                                <span className="truncate">{name}</span>
                            </li>
                        ))}
                    </ul>
                )}

                {summary.hiddenOutputNameCount && summary.hiddenOutputNameCount > 0 && (
                    <p className="mt-2 flex items-center gap-1.5 text-xs text-gray-500">
                        <Archive className="h-3.5 w-3.5" />
                        +{summary.hiddenOutputNameCount} more
                    </p>
                )}
            </div>
        </section>
    );
};

export default ResultSummaryPanel;
