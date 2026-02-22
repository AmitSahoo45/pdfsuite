import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextResponse } from 'next/server';

export const runtime = 'nodejs';

const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
const UPLOAD_TOKEN_TTL_MS = 10 * 60 * 1000;
const ALLOWED_CONTENT_TYPES = ['application/pdf'];
const SAFE_PATHNAME_PATTERN = /^[a-zA-Z0-9/_\-.]+$/;
const COMPRESS_INPUT_PATH_PREFIX = 'compress-inputs/';
const MAX_ORIGINAL_FILENAME_LENGTH = 200;
const DEFAULT_ALLOWED_BROWSER_ORIGINS = [
    'http://localhost:3000',
    'http://127.0.0.1:3000',
] as const;
const UPLOAD_TOKEN_RATE_LIMIT_WINDOW_MS = 60_000;
const UPLOAD_TOKEN_RATE_LIMIT_MAX_REQUESTS = 30;
const uploadTokenRateLimitBuckets = new Map<string, number[]>();

interface CompressUploadClientPayload {
    tool: 'compress-pdf';
    originalFilename?: string;
    sizeBytes?: number;
}

const normalizeOrigin = (value: string): string | null => {
    try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol))
            return null;
        if (url.username || url.password)
            return null;
        if (url.pathname !== '/' || url.search || url.hash)
            return null;
        return url.origin;
    } catch {
        return null;
    }
};

const parseAllowedBrowserOrigins = (): Set<string> => {
    const raw = process.env.UPLOAD_API_ALLOWED_ORIGINS?.trim();
    const candidates = raw
        ? raw.split(',').map((item) => item.trim()).filter(Boolean)
        : [...DEFAULT_ALLOWED_BROWSER_ORIGINS];

    const origins = new Set<string>();
    for (const candidate of candidates) {
        const normalized = normalizeOrigin(candidate);
        if (normalized)
            origins.add(normalized);
    }
    return origins;
};

const ALLOWED_BROWSER_ORIGINS = parseAllowedBrowserOrigins();

const getClientIp = (request: Request): string => {
    const xff = request.headers.get('x-forwarded-for');
    if (xff) {
        const first = xff.split(',')[0]?.trim();
        if (first)
            return first;
    }

    const xRealIp = request.headers.get('x-real-ip')?.trim();
    if (xRealIp)
        return xRealIp;

    return 'unknown';
};

const getRequestOrigin = (request: Request): string | null => {
    const forwardedProto = request.headers.get('x-forwarded-proto')?.split(',')[0]?.trim();
    const forwardedHost = request.headers.get('x-forwarded-host')?.split(',')[0]?.trim();
    if (forwardedProto && forwardedHost) {
        const forwardedOrigin = normalizeOrigin(`${forwardedProto}://${forwardedHost}`);
        if (forwardedOrigin)
            return forwardedOrigin;
    }

    try {
        return normalizeOrigin(new URL(request.url).origin);
    } catch {
        return null;
    }
};

const validateBrowserOrigin = (request: Request): string | null => {
    const origin = request.headers.get('origin');
    if (!origin)
        return 'Missing Origin header.';

    const normalizedOrigin = normalizeOrigin(origin);
    if (!normalizedOrigin)
        return 'Invalid Origin header.';

    const requestOrigin = getRequestOrigin(request);
    if (requestOrigin && normalizedOrigin === requestOrigin)
        return null;
    if (ALLOWED_BROWSER_ORIGINS.has(normalizedOrigin))
        return null;

    return 'Origin is not allowed.';
};

const checkUploadTokenRateLimit = (request: Request): { retryAfterSeconds: number } | null => {
    const now = Date.now();
    const cutoff = now - UPLOAD_TOKEN_RATE_LIMIT_WINDOW_MS;
    const ip = getClientIp(request);
    const key = `upload-token:${ip}`;
    const existing = uploadTokenRateLimitBuckets.get(key) ?? [];
    const recent = existing.filter((timestamp) => timestamp > cutoff);

    if (recent.length >= UPLOAD_TOKEN_RATE_LIMIT_MAX_REQUESTS) {
        uploadTokenRateLimitBuckets.set(key, recent);
        const retryAfterMs = Math.max(1, (recent[0] + UPLOAD_TOKEN_RATE_LIMIT_WINDOW_MS) - now);
        return { retryAfterSeconds: Math.ceil(retryAfterMs / 1000) };
    }

    recent.push(now);
    uploadTokenRateLimitBuckets.set(key, recent);

    if (uploadTokenRateLimitBuckets.size > 5000) {
        for (const [bucketKey, timestamps] of uploadTokenRateLimitBuckets) {
            if (timestamps.length === 0 || timestamps[timestamps.length - 1] <= cutoff)
                uploadTokenRateLimitBuckets.delete(bucketKey);
        }
    }

    return null;
};

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

    const eventType = (body as { type?: unknown })?.type;
    if (eventType === 'blob.generate-client-token') {
        const originError = validateBrowserOrigin(request);
        if (originError) {
            return NextResponse.json(
                { error: originError },
                { status: 403 }
            );
        }

        const limitHit = checkUploadTokenRateLimit(request);
        if (limitHit) {
            return NextResponse.json(
                { error: 'Too many upload token requests. Please wait before trying again.' },
                {
                    status: 429,
                    headers: { 'Retry-After': String(limitHit.retryAfterSeconds) },
                }
            );
        }
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
