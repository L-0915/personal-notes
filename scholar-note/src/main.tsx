import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/variables.css';
import './styles/global.css';
import './styles/editor.css';
import './styles/sidebar.css';
import './styles/backlinks.css';
import './styles/graph.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
