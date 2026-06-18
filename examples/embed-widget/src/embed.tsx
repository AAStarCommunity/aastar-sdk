import React from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { AAStarWidget } from './AAStarWidget';
import type { WidgetOptions } from './config';

// Entry for the vanilla <script> embed (built via vite.embed.config.ts).
// Exposes a tiny imperative API on the global `AAStarWidget` so a NON-React host
// page can drop the widget into any element:
//
//   <div id="aastar-root"></div>
//   <script src="/aastar-widget.iife.js"></script>
//   <script>
//     AAStarWidget.mount('#aastar-root', { apiURL: '...', operator: '0x...' });
//   </script>

const roots = new WeakMap<Element, Root>();

export function mount(
  target: string | Element,
  options: WidgetOptions & { title?: string } = {},
): void {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (!el) {
    throw new Error(`[AAStarWidget] mount target not found: ${String(target)}`);
  }
  const root = createRoot(el);
  roots.set(el, root);
  root.render(React.createElement(AAStarWidget, options));
}

export function unmount(target: string | Element): void {
  const el = typeof target === 'string' ? document.querySelector(target) : target;
  if (el && roots.has(el)) {
    roots.get(el)!.unmount();
    roots.delete(el);
  }
}

// Also export the component for bundlers that consume this entry as a module.
export { AAStarWidget };
