from pathlib import Path
import sys
import unittest

import numpy as np

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from api.page_snapshots import gaze_for_page, group_screens, same_screen, signature


class PageSnapshotTests(unittest.TestCase):
    def test_repeated_page_combines_visits_and_excludes_short_transition(self):
        home = np.full((90, 160, 3), 240, np.uint8)
        product = np.full_like(home, 40)
        transition = np.full_like(home, 130)
        saved = {}
        frames = [(0, home), (.5, home), (1, home), (1.5, transition),
                  (2, product), (2.5, product), (3, product),
                  (3.5, home), (4, home), (4.5, home)]
        pages = group_screens(frames, 5, lambda name, image: saved.update({name: image}))
        self.assertEqual(len(pages), 2)
        self.assertEqual(len(saved), 2)
        self.assertEqual(pages[0]['intervals'], [{'start': 0, 'end': 1.5}, {'start': 3.5, 'end': 5}])
        self.assertEqual(pages[1]['intervals'], [{'start': 2, 'end': 3.5}])
        gaze = [{'timestamp': 100 + t, 'gaze_x': 20, 'gaze_y': 30} for t in [0, 1.49, 1.5, 2, 3.5, 4, 5]]
        self.assertEqual([g['timestamp'] for g in gaze_for_page(gaze, pages[0]['intervals'], 100)], [100, 101.49, 103.5, 104])

    def test_small_cursor_change_does_not_create_new_page(self):
        image = np.full((90, 160, 3), 240, np.uint8)
        cursor = image.copy()
        cursor[30:34, 40:44] = 0
        self.assertTrue(same_screen(signature(image), signature(cursor)))

    def test_distinct_scroll_layout_is_not_combined(self):
        first = np.zeros((90, 160, 3), np.uint8)
        first[:45] = 255
        second = np.roll(first, 30, axis=0)
        self.assertFalse(same_screen(signature(first), signature(second)))


if __name__ == '__main__':
    unittest.main()
