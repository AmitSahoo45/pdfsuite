'use client';

import { z } from 'zod';

export const FileMetaSchema = z.object({
    id: z.string(),
    file: z.custom<File>(
        (v): v is File => v instanceof File,
        { message: 'Expected a File instance' }
    ),
    name: z.string(),
    size: z.number(),
    pages: z.number(),
    rotation: z.number(),
    previewImageUrl: z.string().min(1),
});

export type FileMeta = z.infer<typeof FileMetaSchema>;
