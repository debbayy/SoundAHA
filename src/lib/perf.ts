import { Platform } from 'react-native';

// Android 8.1 (Oreo, API 27) and older: these phones have weak GPUs and little RAM, and stacked
// translucent layers, gradients and shadows are what make them stutter. There the UI keeps its
// colors and shapes but drops the purely decorative depth effects.
export const LITE = Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version < 28;

// A boxShadow string, or none on lite devices (each shadow is an extra blurred draw every frame).
export const shadow = (s: string | undefined) => (LITE ? undefined : s);
