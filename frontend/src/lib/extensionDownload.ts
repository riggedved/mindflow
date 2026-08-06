/**
 * Extension Download Utility
 * Handles downloading the browser extension folder as a zip file
 */

import { authStorage } from './auth';
import { API_BASE_URL } from './config';

/**
 * Generate a device token for the current logged-in user and download an
 * already-linked extension ZIP that embeds that device token so the extension
 * can auto-link on install.
 */

export const downloadLinkedExtension = async () => {
  try {
    const token = authStorage.getToken();
    if (!token) throw new Error('User not authenticated');

    // Request a device token from backend
  const genRes = await fetch(`${API_BASE_URL}/api/v1/extension/generate-device-token`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!genRes.ok) {
      throw new Error('Failed to generate device token');
    }

    const { device_token } = await genRes.json();

    // Download extension with embedded device token
  const downloadRes = await fetch(`${API_BASE_URL}/api/v1/extension/download?device_token=${encodeURIComponent(device_token)}`);
    if (!downloadRes.ok) throw new Error('Failed to download linked extension');

    const blob = await downloadRes.blob();
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    link.download = `mindflow-extension-${timestamp}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
    return true;
  } catch (error) {
    console.error('Linked extension download failed:', error);
    throw error;
  }
};

export const downloadExtension = async () => {
  try {
    // For now, create a link to download from the backend
  const response = await fetch(`${API_BASE_URL}/api/v1/extension/download`, {
      method: 'GET',
    });

    if (!response.ok) {
      throw new Error('Failed to download extension');
    }

    // Get the blob from response
    const blob = await response.blob();

    // Create download link
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    link.download = `mindflow-extension-${timestamp}.zip`;

    // Trigger download
    document.body.appendChild(link);
    link.click();

    // Cleanup
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);

    return true;
  } catch (error) {
    console.error('Extension download failed:', error);
    throw error;
  }
};

/**
 * Fallback: Download pre-packaged extension from public folder
 * Use this if backend endpoint is not available
 */
export const downloadExtensionFallback = () => {
  try {
    // Create download link for pre-packaged extension
    const link = document.createElement('a');
    link.href = '/mindflow-extension.zip'; // Served from public folder
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
    link.download = `mindflow-extension-${timestamp}.zip`;
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    return true;
  } catch (error) {
    console.error('Extension download fallback failed:', error);
    throw error;
  }
};

/**
 * Show installation guide after download
 */
export const showInstallationGuide = () => {
  return `Extension downloaded successfully!

How to Install:
1. Extract the downloaded ZIP file
2. Open Chrome and go to chrome://extensions/
3. Enable "Developer mode" (top-right toggle)
4. Click "Load unpacked"
5. Select the extracted mindflow-extension folder (or 'Backend/Extension' when running from source)
6. Click the extension icon and sign in with Google

The extension is now ready to use!`;
};
