import { get } from '@vercel/blob';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const ALLOWED_BLOB_HOST_SUFFIX = '.blob.vercel-storage.com';
const PRIVATE_BLOB_HOST_SUFFIX = '.private.blob.vercel-storage.com';
const ALLOWED_OUTPUT_PATH_PREFIX = '/compress-outputs/';
const MAX_URL_LENGTH = 4096;

const isAllowedBlobUrl = (value: string): URL | null => {
    if (!value || value.length > MAX_URL_LENGTH)
        return null;

    let parsed: URL;
    try {
        parsed = new URL(value);
    } catch {
        return null;
    }

    if (parsed.protocol !== 'https:')
        return null;
    if (parsed.username || parsed.password)
        return null;
    if (!parsed.hostname.endsWith(ALLOWED_BLOB_HOST_SUFFIX))
        return null;
    if (!parsed.pathname.startsWith(ALLOWED_OUTPUT_PATH_PREFIX))
        return null;

    return parsed;
};

const isPrivateBlobHost = (hostname: string): boolean =>
    hostname.toLowerCase().endsWith(PRIVATE_BLOB_HOST_SUFFIX);

const sanitizeFilename = (value: string | null): string | null => {
    if (!value)
        return null;

    const base = value.replace(/\\/g, '/').split('/').pop()?.trim() ?? '';
    if (!base)
        return null;

    return base.replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0, 200) || null;
};

export async function GET(request: Request) {
    const url = new URL(request.url);
    const blobUrlRaw = url.searchParams.get('url');
    const filename = sanitizeFilename(url.searchParams.get('filename'));

    if (!process.env.BLOB_READ_WRITE_TOKEN) {
        return NextResponse.json(
            { error: 'BLOB_READ_WRITE_TOKEN is not configured.' },
            { status: 500 }
        );
    }

    if (!blobUrlRaw) {
        return NextResponse.json(
            { error: 'Missing blob url.' },
            { status: 400 }
        );
    }

    const parsedBlobUrl = isAllowedBlobUrl(blobUrlRaw);
    if (!parsedBlobUrl) {
        return NextResponse.json(
            { error: 'Invalid blob url.' },
            { status: 400 }
        );
    }

    try {
        const access = isPrivateBlobHost(parsedBlobUrl.hostname) ? 'private' : 'public';
        const result = await get(parsedBlobUrl.toString(), {
            access,
            useCache: false,
        });

        if (!result) {
            return NextResponse.json(
                { error: 'Blob not found.' },
                { status: 404 }
            );
        }

        if (result.statusCode !== 200 || !result.stream) {
            return NextResponse.json(
                { error: 'Blob is not available.' },
                { status: result.statusCode }
            );
        }

        const headers = new Headers();
        const contentType = result.blob.contentType || result.headers.get('content-type') || 'application/pdf';
        headers.set('Content-Type', contentType);

        if (filename) {
            headers.set('Content-Disposition', `attachment; filename="${filename}"`);
        } else {
            const contentDisposition = result.headers.get('content-disposition');
            if (contentDisposition)
                headers.set('Content-Disposition', contentDisposition);
        }

        const contentLength = result.headers.get('content-length');
        if (contentLength)
            headers.set('Content-Length', contentLength);

        headers.set('Cache-Control', 'private, no-store');
        headers.set('X-Content-Type-Options', 'nosniff');

        return new Response(result.stream, {
            status: 200,
            headers,
        });
    } catch (error) {
        console.error('Failed to stream blob download:', error);
        return NextResponse.json(
            { error: 'Failed to download file.' },
            { status: 500 }
        );
    }
}

