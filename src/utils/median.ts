declare global {
  interface Window {
    median?: any;
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
  }
};

export { isMedian };
