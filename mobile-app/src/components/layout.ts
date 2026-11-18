/**
 * Layout measures shared by the tab bar and every screen, so content is never
 * hidden behind the tab bar or the system's navigation area.
 *
 * Android draws edge to edge (Expo SDK 54): the gesture bar or the 3-button bar
 * sits on top of the app, and its height is only known from the safe-area
 * inset. The tab bar adds that inset to its own height, and scrolling content
 * leaves room for both.
 */
import { useSafeAreaInsets } from 'react-native-safe-area-context';

/** The tab bar's own height, without the system's bottom inset. */
export const TAB_BAR_BASE = 64;

/** The tab bar's height on this phone, including the system navigation area. */
export function useTabBarHeight(): number {
  const insets = useSafeAreaInsets();
  return TAB_BAR_BASE + Math.max(insets.bottom, 8);
}

/** Bottom padding for a scroll view on a tab screen: clear of the tab bar, with some air. */
export function useTabContentPadding(): number {
  return useTabBarHeight() + 24;
}

/** Bottom padding for a screen without the tab bar: clear of the system navigation area. */
export function useBottomPadding(extra = 24): number {
  const insets = useSafeAreaInsets();
  return insets.bottom + extra;
}

/** The largest font scale the fixed-size controls (tab labels, pills) follow. */
export const MAX_CONTROL_FONT_SCALE = 1.3;
