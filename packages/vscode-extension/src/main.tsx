import React from 'react';
import { createRoot } from 'react-dom/client';
import { SidebarDemo } from '../webviews/sidebar/demo';

// Import styles
import '../webviews/sidebar/styles.css';

const container = document.getElementById('root');
if (container) {
  const root = createRoot(container);
  root.render(
    <React.StrictMode>
      <SidebarDemo />
    </React.StrictMode>
  );
}
