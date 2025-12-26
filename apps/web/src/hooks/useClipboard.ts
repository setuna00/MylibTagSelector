import { useState } from 'react';

interface UseClipboardResult {
  copy: (text: string) => Promise<{ ok: boolean; error?: string }>;
  isCopied: boolean;
  error: string | null;
}

export function useClipboard(): UseClipboardResult {
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const copy = async (text: string): Promise<{ ok: boolean; error?: string }> => {
    if (!text) {
      setError('No text to copy');
      return { ok: false, error: 'No text to copy' };
    }

    try {
      await navigator.clipboard.writeText(text);
      setIsCopied(true);
      setError(null);
      
      // Reset copied state after 2 seconds
      setTimeout(() => {
        setIsCopied(false);
      }, 2000);
      
      return { ok: true };
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to copy';
      setError(errorMessage);
      setIsCopied(false);
      return { ok: false, error: errorMessage };
    }
  };

  return { copy, isCopied, error };
}

