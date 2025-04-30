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