/**
 * Owner's screenshot: the edit button sat on top of the board's pictures, and
 * the "Create board" tile next to it was shorter. Buttons now live in a bar
 * under the name, and the Create tile takes the same height.
 */
import { screen, within } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';

import { initI18n } from '@/lib/i18n';
import { renderScreen } from '@/test-utils/renderScreen';
import { IconButton } from '@/ui/components';

import { BUILTIN_BOARDS } from '../../builtin';
import { BoardTile, boardTileContentHeight } from '../BoardTile';
import { CreateBoardTile } from '../CreateBoardTile';

const board = { ...BUILTIN_BOARDS[0]!, id: 'custom-1', kind: 'custom' as const, name: 'משפחה' };

beforeAll(() => initI18n());

it('puts the edit/delete buttons under the name, never over the pictures', async () => {
  await renderScreen(
    <BoardTile
      board={board}
      width={160}
      onPress={() => undefined}
      actions={
        <>
          <IconButton icon="pencil" accessibilityLabel="Edit board" />
          <IconButton icon="trash" accessibilityLabel="Delete board" />
        </>
      }
    />,
  );
  const lid = screen.getByTestId('board-tile-lid');
  expect(within(lid).queryByLabelText('Edit board')).toBeNull();
  expect(within(lid).queryByLabelText('Delete board')).toBeNull();
  const bar = screen.getByTestId('board-tile-actions');
  expect(within(bar).getByLabelText('Edit board')).toBeTruthy();
  expect(within(bar).getByLabelText('Delete board')).toBeTruthy();
  expect(screen.getByText('משפחה')).toBeTruthy();
});

it('built-in boards have no button bar', async () => {
  await renderScreen(
    <BoardTile board={BUILTIN_BOARDS[1]!} width={160} onPress={() => undefined} />,
  );
  expect(screen.queryByTestId('board-tile-actions')).toBeNull();
});

it('the Create tile is as tall as the photo-board tiles next to it', async () => {
  await renderScreen(<CreateBoardTile width={160} withActions onPress={() => undefined} />);
  const inner = screen.getByTestId('create-board-tile');
  const { minHeight } = StyleSheet.flatten(inner.props.style) as { minHeight: number };
  expect(minHeight).toBe(boardTileContentHeight(160, true));
  expect(boardTileContentHeight(160, true)).toBeGreaterThan(boardTileContentHeight(160, false));
});
