import { useMemo, useState, type ReactNode } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { ScreenSizeContext } from '@/ui/layout/useScreenSize';
import { palette, shadows } from '@/ui/theme';

import { AppOnlyDialog } from './AppOnlyDialog';
import { DownloadBar } from './DownloadBar';

/** Widest the game gets on a desktop: a phone-like column in the middle. */
export const WEB_COLUMN_MAX_WIDTH = 480;

/**
 * Frame of the web game: the "Download the app" bar on top of every screen,
 * the game in a phone-width column (centered on wide screens), and the
 * "Available in the app" popup.
 */
export function WebShell({ children }: { children: ReactNode }) {
  const window = useWindowDimensions();
  const [barHeight, setBarHeight] = useState(0);
  const width = Math.min(window.width, WEB_COLUMN_MAX_WIDTH);
  const framed = window.width > WEB_COLUMN_MAX_WIDTH;
  const size = useMemo(
    () => ({ width, height: Math.max(0, window.height - barHeight) }),
    [width, window.height, barHeight],
  );

  return (
    <View style={styles.page}>
      <View style={[styles.column, { width }, framed && styles.framed]}>
        <DownloadBar onLayout={(e) => setBarHeight(e.nativeEvent.layout.height)} />
        <ScreenSizeContext.Provider value={size}>
          <View style={styles.content}>{children}</View>
        </ScreenSizeContext.Provider>
      </View>
      <AppOnlyDialog />
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: palette.grapeDark,
  },
  column: {
    flex: 1,
    overflow: 'hidden',
    backgroundColor: palette.grape,
  },
  framed: { boxShadow: shadows.lg },
  content: { flex: 1 },
});
