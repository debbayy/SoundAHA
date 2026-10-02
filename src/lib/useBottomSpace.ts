import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MINI_PLAYER_HEIGHT, TAB_BAR_HEIGHT } from '../theme';
import { usePlayer } from '../context/PlayerContext';

// Bottom padding a scrollable screen needs so its last row clears the floating tab bar (+ mini player).
export function useBottomSpace() {
  const { bottom } = useSafeAreaInsets();
  const { current } = usePlayer();
  return Math.max(bottom, 10) + TAB_BAR_HEIGHT + 20 + (current ? MINI_PLAYER_HEIGHT + 10 : 0);
}
