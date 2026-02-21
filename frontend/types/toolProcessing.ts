export interface ToolProcessingProgress {
    completed: number;
    total: number;
    currentFileName?: string;
    stage?: string;
}
