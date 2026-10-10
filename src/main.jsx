import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { setFontLoader } from './engine/pdfmeta.js';
import stubFontUrl from './assets/fonts/public-sans-latin-400.ttf?url';
// Fonts are bundled with the app (SIL Open Font License) so it looks the same offline.
import '@fontsource/public-sans/400.css';
import '@fontsource/public-sans/400-italic.css';
import '@fontsource/public-sans/500.css';
import '@fontsource/public-sans/600.css';
import '@fontsource/public-sans/700.css';
import '@fontsource/public-sans/800.css';
import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import './styles.css';

// Font embedded into generated stub PDFs (subset per file).
setFontLoader(async () => new Uint8Array(await (await fetch(stubFontUrl)).arrayBuffer()));

createRoot(document.getElementById('root')).render(<App />);
