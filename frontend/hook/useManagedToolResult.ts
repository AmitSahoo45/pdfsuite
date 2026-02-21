'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import { revokeToolResult } from '@/lib/blobUrls';
import type { ToolResult } from '@/types/toolResult';

export function useManagedToolResult() {
    const [result, setResultState] = useState<ToolResult | null>(null);
    const resultRef = useRef<ToolResult | null>(null);

    const setResult = useCallback((nextResult: ToolResult | null) => {
        if (resultRef.current)
            revokeToolResult(resultRef.current);

        resultRef.current = nextResult;
        setResultState(nextResult);
    }, []);

    const clearResult = useCallback(() => {
        setResult(null);
    }, [setResult]);

    useEffect(() => {
        return () => {
            if (resultRef.current)
                revokeToolResult(resultRef.current);
            resultRef.current = null;
        };
    }, []);

    return {
        result,
        setResult,
        clearResult,
    };
}
