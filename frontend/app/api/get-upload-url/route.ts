import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = ['application/pdf'];
const SAFE_PATHNAME_PATTERN = /^[a-zA-Z0-9/_\-.]+$/;

const isAllowedPathname = (value: string): boolean => {
    if (!SAFE_PATHNAME_PATTERN.test(value)) return false;
    if (value.includes('..')) return false;
    return value.toLowerCase().endsWith('.pdf');
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
            onBeforeGenerateToken: async (pathname) => {
                if (!isAllowedPathname(pathname)) {
                    throw new Error('Invalid upload pathname. Only simple .pdf paths are allowed.');
                }

                return {
                    allowedContentTypes: ALLOWED_CONTENT_TYPES,
                    maximumSizeInBytes: MAX_UPLOAD_BYTES,
                    addRandomSuffix: true,
                    tokenPayload: JSON.stringify({
                        tool: 'compress-pdf',
                        uploadedAt: Date.now(),
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
        return NextResponse.json(
            {
                error: error instanceof Error
                    ? error.message
                    : 'Unable to create upload token.',
            },
            { status: 500 }
        );
    }
}
