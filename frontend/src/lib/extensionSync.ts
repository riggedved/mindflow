/**
 * Extension utilities (device-token flow)
 * We only keep a small detection helper used by the UI to hide install CTA
 */

export function checkExtensionInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    // Post message to detect extension
    window.postMessage({ type: 'PING_EXTENSION' }, '*');

    // Listen for response
    const listener = (event: MessageEvent) => {
      if (event.data?.type === 'EXTENSION_ALIVE' && event.data?.source === 'mindflow-extension') {
        window.removeEventListener('message', listener);
        resolve(true);
      }
    };

    window.addEventListener('message', listener);

    // Timeout after 1 second
    setTimeout(() => {
      window.removeEventListener('message', listener);
      resolve(false);
    }, 1000);
  });
}
