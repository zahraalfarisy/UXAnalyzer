"""Group stable recorded screen layouts and keep one still image per layout.

No browser URL is collected: a different scroll position is a different layout.
Transition frames are excluded rather than mixing gaze across moving screens.
"""
import json
from pathlib import Path
import threading

import cv2
import numpy as np

_lock = threading.Lock()
VERSION = 1


def signature(frame):
    return cv2.resize(frame, (96, 54), interpolation=cv2.INTER_AREA).astype(np.float32)


def same_screen(a, b):
    difference = np.abs(a - b).mean(axis=2)
    # Ignore small changes such as a cursor, blinking caret or clock.
    return float(difference.mean()) < 10 and float((difference > 25).mean()) < .12


def group_screens(frames, duration, save_image):
    """frames yields (video time, BGR image); intervals are half-open."""
    pages = []
    pending = None

    def commit(end):
        if pending is None or end - pending['start'] < .75:
            return
        match = next((p for p in pages if same_screen(p['_signature'], pending['signature'])), None)
        if match is None:
            index = len(pages) + 1
            filename = f'page-{index:03d}.jpg'
            save_image(filename, pending['image'])
            match = {'id': index, 'image': filename, 'intervals': [], '_signature': pending['signature']}
            pages.append(match)
        match['intervals'].append({'start': pending['start'], 'end': end})

    for timestamp, image in frames:
        current = signature(image)
        if pending is None or not same_screen(pending['signature'], current):
            commit(timestamp)
            pending = {'start': timestamp, 'signature': current, 'image': image.copy()}
    commit(duration)
    return [{k: v for k, v in page.items() if not k.startswith('_')} for page in pages]


def ensure_snapshots(session_dir: Path):
    video = session_dir / 'screen.mp4'
    if not video.exists() or not video.stat().st_size:
        return []
    folder = session_dir / 'page_snapshots'
    manifest = folder / 'manifest.json'
    stat = video.stat()
    source = {'version': VERSION, 'size': stat.st_size, 'modified': stat.st_mtime_ns}
    with _lock:
        if manifest.exists():
            cached = json.loads(manifest.read_text(encoding='utf-8'))
            if cached.get('source') == source and all((folder / p['image']).exists() for p in cached['pages']):
                return cached['pages']
        cap = cv2.VideoCapture(str(video))
        try:
            fps = cap.get(cv2.CAP_PROP_FPS)
            count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
            if not cap.isOpened() or fps <= 0 or count <= 0:
                raise RuntimeError('Screen video could not be decoded into page screenshots')
            folder.mkdir(exist_ok=True)
            def frames():
                step = max(1, round(fps / 2))
                index = 0
                while True:
                    ok = cap.grab()
                    if not ok:
                        break
                    if index % step == 0:
                        ok, image = cap.retrieve()
                        if ok:
                            yield index / fps, image
                    index += 1
            def save_image(filename, image):
                if not cv2.imwrite(str(folder / filename), image, [cv2.IMWRITE_JPEG_QUALITY, 92]):
                    raise RuntimeError('Could not save page screenshot')
            pages = group_screens(frames(), count / fps, save_image)
            temp = manifest.with_suffix('.tmp')
            temp.write_text(json.dumps({'source': source, 'pages': pages}), encoding='utf-8')
            temp.replace(manifest)
            return pages
        finally:
            cap.release()


def gaze_for_page(gaze, intervals, origin):
    return [g for g in gaze if any(origin + window['start'] <= g['timestamp'] < origin + window['end'] for window in intervals)]
