declare global {
  interface Window {
    median?: any;
    median_appbrowser_closed?: () => void;
  }
}

const isMedian = () => !!window.median;

export const median = {
  haptics: {
    tap: () => isMedian() && window.median.haptics.tap(),
  },
  share: (url: string, text?: string) => {
    isMedian() && window.median.share.open({ url, text });
  },
  clipboard: (text: string) => {
    isMedian() && window.median.clipboard.set(text);
  },
  push: {
    register: () => isMedian() && window.median.onesignal.register(),
    getPlayerId: (): Promise<string | null> => {
      return isMedian() ? window.median.onesignal.onesignalInfo() : Promise.resolve(null);
    }
  },
  window: {
    /**
     * Open URL in Median's in-app browser or other modes
     * @param url - The URL to open
     * @param mode - 'blank' | 'internal' | 'external' | 'appbrowser'
     *   - blank: Opens in a new browser tab/window
     *   - internal: Opens within the app webview
     *   - external: Opens in the system browser
     *   - appbrowser: Opens in Median's in-app browser (recommended for OAuth)
     */
    open: (url: string, mode: 'blank' | 'internal' | 'external' | 'appbrowser' = 'appbrowser'): boolean => {
      if (isMedian() && window.median.window?.open) {
        window.median.window.open(url, mode);
        return true;
      }
      return false;
    },
  },
  /**
   * Get the app's custom URL scheme configured in Median App Studio
   * Format: scheme.https://domain/path will be intercepted by the app
   * @returns The URL scheme (e.g., 'weavefabric')
   */
  getUrlScheme: (): string => {
    // This should match what's configured in Median App Studio > Link Handling > URL Scheme Protocol
    return 'weavefabric';
  },
};

export { isMedian };
