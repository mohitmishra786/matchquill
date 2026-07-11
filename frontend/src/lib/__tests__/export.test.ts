/**
 * Export helper unit tests
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { escapeHtml, downloadBlob } from '../export';

describe('escapeHtml', () => {
    it('escapes special HTML characters', () => {
        expect(escapeHtml('<script>"x"&\'y\'</script>')).toBe(
            '&lt;script&gt;&quot;x&quot;&amp;&#39;y&#39;&lt;/script&gt;'
        );
    });

    it('returns plain text unchanged', () => {
        expect(escapeHtml('Hello world')).toBe('Hello world');
    });
});

describe('downloadBlob', () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
        // Clean up shared link if present
        document.querySelectorAll('a[aria-hidden="true"]').forEach((el) => el.remove());
    });

    it('triggers download via a reused anchor without thrashing append/remove', () => {
        const createObjectURL = vi.fn().mockReturnValue('blob:mock-url');
        const revokeObjectURL = vi.fn();
        vi.stubGlobal('URL', {
            ...URL,
            createObjectURL,
            revokeObjectURL,
        });

        const blob = new Blob(['hello'], { type: 'text/plain' });
        const appendSpy = vi.spyOn(document.body, 'appendChild');

        downloadBlob(blob, 'test.txt');
        downloadBlob(blob, 'test2.txt');

        // Anchor is appended once and reused
        const appendsForDownload = appendSpy.mock.calls.filter(
            (call) => (call[0] as HTMLElement).tagName === 'A'
        );
        expect(appendsForDownload.length).toBeLessThanOrEqual(1);
        expect(createObjectURL).toHaveBeenCalledTimes(2);

        vi.advanceTimersByTime(1000);
        expect(revokeObjectURL).toHaveBeenCalled();

        appendSpy.mockRestore();
        vi.unstubAllGlobals();
    });
});
