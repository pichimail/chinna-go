export const vibrate = (pattern: number | number[]) => {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    try {
      navigator.vibrate(pattern);
    } catch (e) {
      // Ignore errors on unsupported devices
    }
  }
};

export const HAPTICS = {
  light: 10,
  medium: [20],
  heavy: [30],
  typing: 5,
  chinnaTyping: [5, 50, 5],
  success: [10, 30, 20],
  error: [20, 50, 20, 50, 20],
  voiceStart: [15, 30, 15],
  voiceStop: [10, 20, 10],
};
