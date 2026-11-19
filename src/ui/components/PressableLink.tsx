import type { ComponentType } from 'react';
import { Pressable, type PressableProps } from 'react-native';

/**
 * Pressable that can be a real link on the web: react-native-web renders a
 * view with `href` as an `<a href>`. The React Native types don't list `href`;
 * pass it only on the web (native ignores it — open the URL in onPress there).
 */
export const PressableLink = Pressable as ComponentType<PressableProps & { href?: string }>;
