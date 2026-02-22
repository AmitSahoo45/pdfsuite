import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const UPLOAD_TOKEN_TTL_MS = 10 * 60 * 1000;
const ALLOWED_CONTENT_TYPES = ['application/pdf'];
const SAFE_PATHNAME_PATTERN = /^[a-zA-Z0-9/_\-.]+$/;
const COMPRESS_INPUT_PATH_PREFIX = 'compress-inputs/';
const MAX_ORIGINAL_FILENAME_LENGTH = 200;

interface CompressUploadClientPayload {
    tool: 'compress-pdf';
    originalFilename?: string;
    sizeBytes?: number;
}

const isAllowedPathname = (value: string): boolean => {
    if (!SAFE_PATHNAME_PATTERN.test(value)) return false;
    if (value.includes('..')) return false;
    if (!value.startsWith(COMPRESS_INPUT_PATH_PREFIX)) return false;
    return value.toLowerCase().endsWith('.pdf');
};

const parseClientPayload = (raw: string | null): CompressUploadClientPayload => {
    if (!raw)
        throw new Error('Missing upload client payload.');

    let parsed: unknown;
    try {
        parsed = JSON.parse(raw);
    } catch {
        throw new Error('Invalid upload client payload JSON.');
    }

    if (!parsed || typeof parsed !== 'object')
        throw new Error('Invalid upload client payload.');

    const record = parsed as Record<string, unknown>;
    if (record.tool !== 'compress-pdf')
        throw new Error('Upload token is only available for compress-pdf.');

    if (record.originalFilename !== undefined) {
        if (typeof record.originalFilename !== 'string')
            throw new Error('Invalid originalFilename in upload payload.');
        if (record.originalFilename.length < 1 || record.originalFilename.length > MAX_ORIGINAL_FILENAME_LENGTH)
            throw new Error('Invalid originalFilename length in upload payload.');
    }

    if (record.sizeBytes !== undefined) {
        if (typeof record.sizeBytes !== 'number' || !Number.isFinite(record.sizeBytes))
            throw new Error('Invalid sizeBytes in upload payload.');
        if (record.sizeBytes <= 0 || record.sizeBytes > MAX_UPLOAD_BYTES)
            throw new Error(`File size exceeds max supported size of ${MAX_UPLOAD_BYTES} bytes.`);
    }

    return {
        tool: 'compress-pdf',
        originalFilename: typeof record.originalFilename === 'string' ? record.originalFilename : undefined,
        sizeBytes: typeof record.sizeBytes === 'number' ? record.sizeBytes : undefined,
    };
};

const getErrorStatus = (message: string): number => {
    if (
        message.startsWith('Invalid ') ||
        message.startsWith('Missing ') ||
        message.includes('only available for compress-pdf') ||
        message.includes('exceeds max supported size')
    ) {
        return 400;
    }
    return 500;
};

export async function POST(request: Request) {
    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json(
            { error: 'BLOB_READ_WRITE_TOKEN is not configured.' },
            { status: 500 }
        );
    }

    let body: HandleUploadBody;
    try {
        body = (await request.json()) as HandleUploadBody;
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
    }

    try {
        const result = await handleUpload({
            request,
            body,
            onBeforeGenerateToken: async (pathname, clientPayload) => {
                if (!isAllowedPathname(pathname)) {
                    throw new Error('Invalid upload pathname. Only simple .pdf paths are allowed.');
                }

                const parsedPayload = parseClientPayload(clientPayload);
                const now = Date.now();
                const validUntil = now + UPLOAD_TOKEN_TTL_MS;

                return {
                    allowedContentTypes: ALLOWED_CONTENT_TYPES,
                    maximumSizeInBytes: MAX_UPLOAD_BYTES,
                    validUntil,
                    addRandomSuffix: true,
                    allowOverwrite: false,
                    cacheControlMaxAge: 60 * 60,
                    tokenPayload: JSON.stringify({
                        tool: parsedPayload.tool,
                        uploadedAt: now,
                        validUntil,
                        originalFilename: parsedPayload.originalFilename ?? null,
                        sizeBytes: parsedPayload.sizeBytes ?? null,
                    }),
                };
            },
            onUploadCompleted: async ({ blob }) => {
                // Placeholder hook for future persistence/analytics. We intentionally do nothing
                // here because PDFSuite is stateless and does not store user records.
                void blob;
            },
        });

        return NextResponse.json(result);
    } catch (error) {
        console.error('Failed to generate blob upload token:', error);
        const message = error instanceof Error
            ? error.message
            : 'Unable to create upload token.';
        return NextResponse.json(
            { error: message },
            { status: getErrorStatus(message) }
        );
    }
}
