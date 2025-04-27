import Image from "next/image";
import { Card } from "@/components/ui/card";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";
import { RotateCcw, X } from "lucide-react";
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

const FileCard = ({
    file,
    onRotate,
    onRemove,
}: {
    file: FileMeta;
    onRotate: (id: string) => void;
    onRemove: (id: string) => void;
}) => {
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: file.id });

    const dndStyle = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
        zIndex: isDragging ? 100 : 'auto',
        touchAction: 'none'
    };


    return (
        <div ref={setNodeRef} style={dndStyle} {...attributes} {...listeners}>
            <TooltipProvider delayDuration={100}>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Card className="relative w-[140px] select-none overflow-hidden rounded-lg border shadow-sm">

                            <div className="absolute top-1 right-1 z-10 flex flex-col gap-1">
                                <button
                                    onClick={() => { onRotate(file.id); }}
                                    onPointerDownCapture={(e) => e.stopPropagation()}
                                    className="rounded-full bg-background/80 p-1 shadow hover:bg-background"
                                    aria-label="Rotate PDF preview"
                                >
                                    <RotateCcw className="h-4 w-4" />
                                </button>
                                <button
                                    onClick={() => { onRemove(file.id); }}
                                    onPointerDownCapture={(e) => e.stopPropagation()}
                                    className="rounded-full bg-background/80 p-1 shadow hover:bg-background"
                                    aria-label="Remove PDF file"
                                >
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="flex h-[90px] w-full items-center justify-center overflow-hidden bg-gray-100">
                                <Image
                                    src={file.previewImageUrl}
                                    alt={`Preview of ${file.name}`}
                                    width={140}
                                    height={90}
                                    className="object-cover transition-transform duration-200 ease-in-out"
                                    style={{ transform: `rotate(${file.rotation}deg)` }}
                                />
                            </div>

                            <p className="truncate px-2 py-1.5 text-center text-xs font-medium text-gray-700">
                                {file.name}
                            </p>
                        </Card>
                    </TooltipTrigger>

                    <TooltipContent
                        side="bottom" 
                        align="center"
                        sideOffset={5}
                        className="rounded bg-muted-foreground px-2 py-1 text-xs font-medium text-background shadow"
                    >
                        {(file.size / 1024).toFixed(2)} KB • {file.pages} pg
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </div>
    );
}

export default FileCard;