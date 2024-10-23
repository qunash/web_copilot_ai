import { createRoot } from 'react-dom/client';
import { ChatInterface } from './components/ChatInterface';

const root = createRoot(document.getElementById('root')!);
root.render(<ChatInterface />);