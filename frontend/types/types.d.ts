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
    file: File; // Keep the original File object
    name: string;
    size: number;
    pages: number;
    rotation: number;
    previewImageUrl: string; // URL for the generated image preview
    // preview: string; // We might not need the blob URL anymore
};