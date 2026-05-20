import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Chat } from './pages/Chat';
import { Voice } from './pages/Voice';
import { Create } from './pages/Create';
import { History } from './pages/History';
import { Settings } from './pages/Settings';
import { Privacy } from './pages/Privacy';
import { Help } from './pages/Help';
import { InstallPrompt } from './components/InstallPrompt';
import { Toaster } from 'sonner';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <InstallPrompt />
        <Toaster position="top-center" theme="dark" />
        <Routes>
          <Route path="/" element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="chat" element={<Chat />} />
            <Route path="voice" element={<Voice />} />
            <Route path="create" element={<Create />} />
            <Route path="history" element={<History />} />
            <Route path="settings" element={<Settings />} />
            <Route path="privacy" element={<Privacy />} />
            <Route path="help" element={<Help />} />
          </Route>
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
