import { createContext, useContext } from 'react';
import { useWindowDimensions } from 'react-native';

export interface ScreenSize {
  width: number;
  height: number;
}

/**
 * The area screens are drawn in. In the app that is the window. In the web
 * game on a desktop it is the phone-width column in the middle of the page
 * (see src/features/web/WebShell.web.tsx), so layouts computed from it —
 * board tiles, the compact home hero — match what is actually on screen.
 */
export const ScreenSizeContext = createContext<ScreenSize | null>(null);

export function useScreenSize(): ScreenSize {
  const window = useWindowDimensions();
  return useContext(ScreenSizeContext) ?? window;
}
