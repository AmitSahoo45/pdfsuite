export interface ToolResultFile {
    url: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
}

export interface ToolSummary {
    phase: 'planned' | 'completed';
    modeLabel: string;
    outputCount: number;
    outputNames: string[];
    hiddenOutputNameCount?: number;
    totalSizeBytes: number | null;
    isEstimatedSize: boolean;
    zipAvailable: boolean;
    zipName?: string;
    zipSizeBytes?: number | null;
    note?: string;
}

export type ToolResult =
    | {
        kind: 'single';
        modeLabel: string;
        file: ToolResultFile;
    }
    | {
        kind: 'zip';
        modeLabel: string;
        file: ToolResultFile;
    }
    | {
        kind: 'multi';
        modeLabel: string;
        files: ToolResultFile[];
        zipFile?: ToolResultFile;
    };
