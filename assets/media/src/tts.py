"""Synthesize the walkthrough voiceover offline with Kokoro (af_heart), one WAV per cue.

Writes, under $WALKTHROUGH_WORK, tts/cue-NN.wav, timings.json (cue and scene times in the master track) and the raw master
tts/master-raw.wav (0.5 s head and tail). Loudness normalization is done afterwards by ffmpeg.
"""
import json
import os
import sys
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro_onnx import Kokoro

SRC = Path(__file__).resolve().parent                   # assets/media/src: cues.json
HERE = Path(os.environ.get("WALKTHROUGH_WORK", Path.home() / ".cache/mdlearn-walkthrough"))
HEAD = TAIL = 0.5          # seconds of silence at each end of the master track
CUE_GAP = 0.25             # between sentences of one scene
SCENE_GAP = 0.6            # between scenes, where the picture changes
TRIM_DB = -45              # trim leading/trailing near-silence of each chunk


def trim(samples: np.ndarray, sr: int) -> np.ndarray:
    level = 10 ** (TRIM_DB / 20)
    loud = np.flatnonzero(np.abs(samples) > level)
    if loud.size == 0:
        return samples
    pad = int(0.04 * sr)
    return samples[max(loud[0] - pad, 0): min(loud[-1] + pad, samples.size)]


def main() -> None:
    cues = json.loads((SRC / "cues.json").read_text())
    kokoro = Kokoro(str(HERE / "models/kokoro-v1.0.onnx"), str(HERE / "models/voices-v1.0.bin"))
    out = HERE / "tts"
    out.mkdir(exist_ok=True)
    sr_all = None
    pieces: list[np.ndarray] = []
    t = HEAD
    timings = {"scenes": []}
    n = 0
    for s_index, scene in enumerate(cues["scenes"]):
        scene_start = t
        cue_times = []
        for c_index, cue in enumerate(scene["cues"]):
            samples, sr = kokoro.create(cue["say"], voice=cues["voice"], speed=cues["speed"], lang="en-us")
            if sr_all is None:
                sr_all = sr
                pieces.append(np.zeros(int(HEAD * sr), dtype=np.float32))
            samples = trim(np.asarray(samples, dtype=np.float32), sr)
            n += 1
            sf.write(out / f"cue-{n:02d}.wav", samples, sr)
            duration = samples.size / sr
            cue_times.append({"n": n, "text": cue["text"], "start": round(t, 3), "end": round(t + duration, 3)})
            pieces.append(samples)
            t += duration
            last_cue = c_index == len(scene["cues"]) - 1
            last_scene = s_index == len(cues["scenes"]) - 1
            if not (last_cue and last_scene):
                gap = (SCENE_GAP if last_cue else CUE_GAP) + float(cue.get("pause_after", 0))
                pieces.append(np.zeros(int(gap * sr), dtype=np.float32))
                t += gap
            print(f"cue {n:02d} {duration:5.2f}s  {cue['text'][:60]}", file=sys.stderr)
        timings["scenes"].append({"id": scene["id"], "start": round(scene_start, 3), "cues": cue_times})
    pieces.append(np.zeros(int(TAIL * sr_all), dtype=np.float32))
    t += TAIL
    master = np.concatenate(pieces)
    sf.write(out / "master-raw.wav", master, sr_all)
    # each scene runs until the next one starts; the last one until the end of the track
    for a, b in zip(timings["scenes"], timings["scenes"][1:]):
        a["end"] = b["start"]
    timings["scenes"][-1]["end"] = round(t, 3)
    timings["duration"] = round(t, 3)
    timings["sampleRate"] = sr_all
    (HERE / "timings.json").write_text(json.dumps(timings, indent=2))
    print(f"total {t:.2f}s", file=sys.stderr)


if __name__ == "__main__":
    main()
