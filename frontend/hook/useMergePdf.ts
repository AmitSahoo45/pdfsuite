'use client';
import { useCallback, useState, useMemo } from 'react';
import { toast } from 'react-hot-toast';
import { z } from 'zod';

export const FileMetaSchema = z.object({
    id: z.string(),
    file: z.custom((v): v is File => v !== null && typeof (v as any).name === 'string' && typeof (v as any).size === 'number'),
    name: z.string(),
    size: z.number(),
    pages: z.number(),
    rotation: z.number(),
    previewImageUrl: z.string().min(1),
});

export type FileMeta = z.infer<typeof FileMetaSchema>;
