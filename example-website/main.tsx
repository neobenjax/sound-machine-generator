import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/styles/tokens.css';
import '../src/styles/global.css';
import { ExampleApp } from './ExampleApp';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ExampleApp />
  </StrictMode>
);
