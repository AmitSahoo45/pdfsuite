'use client';

import Link from 'next/link';
import { useEffect } from 'react';

interface AppErrorProps {
    error: Error & { digest?: string };
    reset: () => void;
}

export default function AppError({ error, reset }: AppErrorProps) {
    useEffect(() => {
        console.error('Unhandled route error:', error);
    }, [error]);

    return (
        <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-4 px-6 text-center">
            <h2 className="text-2xl font-semibold text-gray-900">Something went wrong</h2>
            <p className="text-sm text-gray-600">
                The page encountered an unexpected error. You can retry or return to the home page.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                    type="button"
                    onClick={reset}
                    className="rounded-lg bg-red-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
                >
                    Try again
                </button>
                <Link
                    href="/"
                    className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
                >
                    Go to home
                </Link>
            </div>
        </div>
    );
}
