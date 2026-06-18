import React from 'react';
import { createRoot } from 'react-dom/client';
import { AAStarWidget } from './AAStarWidget';

// Demo harness: mounts the widget into the host page (index.html #root).
const el = document.getElementById('root');
if (el) {
  createRoot(el).render(
    <React.StrictMode>
      <AAStarWidget />
    </React.StrictMode>,
  );
}
