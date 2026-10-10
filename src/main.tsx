import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './styles/tokens.css';
import './styles/app.css';
import './styles/refinements.css';
import './styles/kanban-refinements.css';
import './styles/space-tools.css';
import './styles/loading.css';

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
