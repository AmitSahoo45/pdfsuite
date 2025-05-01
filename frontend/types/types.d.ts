type Feature = {
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
    badge?: string;
    reDirectURL?: string;
};
type FileMeta = {
    id: string;
    file: File;
    name: string;
    size: number;
    pages: number;
    rotation: number;
    previewImageUrl: string;
    preview?: string;
};

// Note: Expected structure of messages from the worker 
interface WorkerResponse {
    success: boolean;
    url: string;
    error?: string;
}

// Note: Structure for queued requests
interface PreviewRequest {
    file: File;
    resolve: (url: string) => void;
    reject: (reason?: any) => void;
}

interface PdfProcessingLayoutProps {
    title: string; // This will be teh title fo the page
    dropzoneProps: { // Props needed from useDropzone hook
        getRootProps: <T extends DropzoneRootProps>(props?: T) => T;
        getInputProps: <T extends DropzoneInputProps>(props?: T) => T;
        // Todo : Read docs whats dropzoneProps might be requiring
        open: () => void;
        isDragActive: boolean;
    };
    processingState: { 
        isLoading: boolean;
        isGeneratingPreviews: boolean;
    };
    fileLimits: { 
        maxFiles: number;
        maxFileSizeMB: number;
    };
    children: { 
        fileDisplayArea: React.ReactNode; 
        actionButtonsArea: React.ReactNode; 
        noFilesPlaceholder?: React.ReactNode; 
    };
}