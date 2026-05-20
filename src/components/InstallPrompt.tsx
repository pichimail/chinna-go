import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Smartphone } from 'lucide-react';

export function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Only show if we haven't dismissed it recently
      if (!localStorage.getItem('chinna_install_dismissed')) {
        setShowPrompt(true);
      }
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowPrompt(false);
    }
    setDeferredPrompt(null);
  };

  const handleDismiss = () => {
    setShowPrompt(false);
    localStorage.setItem('chinna_install_dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {showPrompt && (
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 50 }}
          className="fixed bottom-20 left-4 right-4 md:left-auto md:right-8 md:bottom-8 md:w-96 bg-app-surface border border-white/10 rounded-3xl p-6 shadow-2xl z-[100] backdrop-blur-xl"
        >
          <button 
            onClick={handleDismiss}
            className="absolute top-4 right-4 text-white/50 hover:text-white"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-app-lime rounded-2xl flex items-center justify-center shrink-0">
              <Smartphone className="w-6 h-6 text-black" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Install Chinna</h3>
              <p className="text-sm text-white/60">Add to your home screen for a better experience.</p>
            </div>
          </div>
          
          <button
            onClick={handleInstall}
            className="w-full bg-white text-black font-semibold py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gray-200 transition-colors"
          >
            <Download className="w-4 h-4" /> Install App
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
