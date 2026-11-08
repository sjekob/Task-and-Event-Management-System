import { createRoot } from 'react-dom/client';
import App from './App';
import { AppProvider } from './app/AppContext';
import { FeedbackProvider } from './ui/feedback';
import './styles/base.css';
import './styles/shell.css';
import './styles/controls.css';
import './styles/overlays.css';
import './styles/widgets.css';

createRoot(document.getElementById('root')!).render(
  <AppProvider>
    <FeedbackProvider>
      <App />
    </FeedbackProvider>
  </AppProvider>,
);
