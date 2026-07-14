import '@testing-library/jest-dom';

// Polyfill React.act for React 19 compatibility with testing-library
// This needs to happen before any React imports
import React from 'react';

// Polyfill for React 19 - React.act is available as a static method
if (!globalThis.React) {
  (globalThis as typeof globalThis & { React: typeof React }).React = React;
}

// jsdom does not implement layout, so `HTMLElement.offsetParent` always
// returns null (see https://github.com/jsdom/jsdom/issues/1590). Several
// utilities (e.g. src/lib/keyboardNavigation.ts) rely on offsetParent to
// detect hidden elements, which works correctly in real browsers but makes
// those utilities untestable under jsdom without this polyfill. This
// approximates visibility from inline `style.display`/`hidden` rather than
// full layout, which is sufficient for unit tests that only use inline
// styles to hide elements.
Object.defineProperty(window.HTMLElement.prototype, 'offsetParent', {
  get(this: HTMLElement) {
    let node: HTMLElement | null = this;
    while (node) {
      if (node.style?.display === 'none' || node.hidden) {
        return null;
      }
      node = node.parentElement;
    }
    return this.parentElement ?? document.body;
  },
  configurable: true,
});
