type Feature = {
    title: string;
    description: string;
    icon: React.ElementType;
    color: string;
    badge?: string;
    reDirectURL?: string;
};

interface WorkerResponse {
    success: boolean;
    url?: string;
    error?: string;
}

interface PreviewRequest {
    file: File;
    resolve: (url: string) => void;
    reject: (reason?: unknown) => void;
}
