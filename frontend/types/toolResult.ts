export interface ToolResultFile {
    url: string;
    filename: string;
    mimeType: string;
    sizeBytes: number;
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
