import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Download, Chrome, X } from 'lucide-react';
import { downloadExtension, downloadLinkedExtension } from '@/lib/extensionDownload';
import { checkExtensionInstalled } from '@/lib/extensionSync';
import { useToast } from '@/hooks/use-toast';
import { authStorage } from '@/lib/auth';

const FloatingExtensionButton: React.FC = () => {
  const { toast } = useToast();
  const [isVisible, setIsVisible] = useState(true);
  const [isDismissed, setIsDismissed] = useState(false);
  const [extensionInstalled, setExtensionInstalled] = useState(false);
  const [showPulse, setShowPulse] = useState(true);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    // Reset session-only dismissal when the authenticated user session changes
    try {
      const currentUserId = (authStorage.getUser && authStorage.getUser())?.id ?? 'anon';
      const KEY = 'mf-auth-session-id';
      const prev = sessionStorage.getItem(KEY);
      if (String(prev) !== String(currentUserId)) {
        // New auth session detected (logout->login or user switched)
        sessionStorage.setItem(KEY, String(currentUserId));
        sessionStorage.removeItem('extension-button-dismissed');
        // Re-enable visibility (will still hide if extension is installed)
        setIsDismissed(false);
        setIsVisible(true);
      }
    } catch (_) {}

    // Session-only dismiss check (button returns next session)
    const dismissed = sessionStorage.getItem('extension-button-dismissed');
    if (dismissed === 'true') {
      setIsDismissed(true);
      setIsVisible(false);
      return;
    }

    // Stop pulse animation after 5 seconds
    const pulseTimeout = setTimeout(() => {
      setShowPulse(false);
    }, 5000);

    // Ping extension to check if installed
    const checkExtension = () => {
      window.postMessage({ type: 'PING_EXTENSION' }, '*');
    };

    // Listen for extension response
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== window) return;
      
      if (event.data.type === 'EXTENSION_ALIVE' || event.data.type === 'EXTENSION_INSTALLED') {
        setExtensionInstalled(true);
        setIsVisible(false);
      }
    };

    window.addEventListener('message', handleMessage);
    
    // Check on mount
    checkExtension();

    // Also use the helper to detect installation more reliably
    (async () => {
      try {
        const installed = await checkExtensionInstalled();
        if (installed) {
          setExtensionInstalled(true);
          setIsVisible(false);
        }
      } catch (e) {
        // ignore
      }
    })();
    
    // Check again after a delay (in case content script loads late)
    const timeoutId = setTimeout(checkExtension, 1000);

    return () => {
      window.removeEventListener('message', handleMessage);
      clearTimeout(timeoutId);
      clearTimeout(pulseTimeout);
    };
  }, []);

  const handleDismiss = () => {
    setIsVisible(false);
    sessionStorage.setItem('extension-button-dismissed', 'true');
    setIsDismissed(true);
  };

  const handleDownload = async () => {
    try {
      setDownloading(true);
      // Mirror Settings.tsx: prefer linked when authenticated, else fallback
      try {
        if (authStorage.isAuthenticated()) {
          await downloadLinkedExtension();
        } else {
          await downloadExtension();
        }
      } catch (err) {
        console.warn('Linked download failed or not available, falling back:', err);
        await downloadExtension();
      }
      toast({
        title: 'Extension Downloaded!',
        description: 'Extract the ZIP and load it via chrome://extensions/ (pick the mindflow-extension folder, or Backend/Extension when running from source).',
        duration: 10000,
      });
    } catch (error: any) {
      toast({
        title: "Download Failed",
        description: error.message || "Could not download extension. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDownloading(false);
    }
  };

  // Hide completely if installed or dismissed this session
  if (!isVisible || isDismissed || extensionInstalled) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <div className="relative group flex items-center gap-2">
        {/* Glow effect */}
        {showPulse && (
          <div className="absolute -inset-2 rounded-full bg-indigo-500/30 blur-lg transition-opacity group-hover:opacity-100 opacity-80 pointer-events-none" />
        )}

        <Button
          onClick={handleDownload}
          disabled={downloading}
          className="relative flex items-center gap-3 rounded-full px-5 py-3 text-white bg-gradient-to-r from-indigo-500 to-purple-600 shadow-lg hover:shadow-2xl hover:from-indigo-600 hover:to-purple-700 transition-all duration-300 will-change-transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-80"
        >
          <Chrome className="w-5 h-5" />
          <span className="font-medium">{downloading ? 'Downloading…' : 'Install Extension'}</span>
          <Download className="w-4 h-4 opacity-90" />
        </Button>

        {/* Dismiss button (session-only) */}
        <button
          onClick={handleDismiss}
          className="ml-1 grid place-items-center h-8 w-8 rounded-full bg-background/70 border border-white/10 shadow hover:bg-background/90 transition-colors"
          aria-label="Dismiss"
          title="Dismiss (for this session)"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default FloatingExtensionButton;
