#!/usr/bin/env bash
# Rebuild the walkthrough video, its subtitles and the README clips, all on this computer (no cloud services).
#
#   assets/media/src/build.sh            everything: voice, UI capture, composition, render, deliverables
#   assets/media/src/build.sh --no-capture   reuse the UI footage already recorded in the work folder
#
# Needs: Node.js 22.15+, the repo built (npm install && npm run build), ffmpeg with libx264, libass and libwebp,
# ImageMagick, uv, and Playwright's Chromium (npx playwright install chromium). Fonts: Noto Sans and JetBrains Mono
# from the system (paths in build.py), Source Serif 4 from node_modules.
# The "make it yours" segment asks a real AI: Ollama running on this computer with qwen3:8b pulled (ollama pull qwen3:8b).
# Scratch files (about 1 GB: the voice model, frames, intermediate video) go to $WALKTHROUGH_WORK.
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$SRC/../../.." && pwd)"
export WALKTHROUGH_WORK="${WALKTHROUGH_WORK:-$HOME/.cache/mdlearn-walkthrough}"
export DO_NOT_TRACK=1          # HyperFrames sends anonymous usage data unless this is set
W="$WALKTHROUGH_WORK"
mkdir -p "$W/models" "$W/compose"

# 1. Tools, pinned: Kokoro (offline TTS, voice af_heart), HyperFrames 0.8.209 and GSAP 3.15.0 (both two weeks old or more)
if [ ! -x "$W/.venv/bin/python" ]; then
  uv venv --python 3.12 "$W/.venv"
  uv pip install --python "$W/.venv/bin/python" "kokoro-onnx==0.6.1" soundfile numpy
fi
for f in kokoro-v1.0.onnx voices-v1.0.bin; do
  [ -f "$W/models/$f" ] || curl -sSLf -o "$W/models/$f" "https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/$f"
done
if [ ! -d "$W/compose/node_modules/hyperframes" ]; then
  (cd "$W/compose" && npm init -y >/dev/null && npm i --no-audit --no-fund hyperframes@0.8.209 gsap@3.15.0)
fi

# 2. Voice: one WAV per cue from cues.json, and timings.json that every later step follows
"$W/.venv/bin/python" -B "$SRC/tts.py"

# 3. UI footage from a throw-away Studio (temp library and settings; nothing of yours is read): rehearse, then record
if [ "${1:-}" != "--no-capture" ]; then
  node "$SRC/capture.mjs" --rehearse
  DEMO_BASE="${DEMO_BASE:-$(mktemp -u /tmp/student-XXXX)}" node "$SRC/capture.mjs"
  node "$SRC/capture.mjs" --rehearse --only yours
  node "$SRC/capture.mjs" --only yours
fi

# 4. Pieces and the HyperFrames composition, then the render
python3 -B "$SRC/build.py"
SHELL_BIN="$(ls -d "$HOME"/.cache/ms-playwright/chromium_headless_shell-*/*/chrome-headless-shell 2>/dev/null | sort -V | tail -1 || true)"
if [ -n "$SHELL_BIN" ]; then export HYPERFRAMES_BROWSER_PATH="$SHELL_BIN"; fi
mkdir -p "$W/out"
(cd "$W/compose" && npx hyperframes render project -o "$W/out/walkthrough-raw.mp4" -w 3 --video-frame-format png --crf 18 --quiet)

# 5. Master with AAC audio, SRT + burned-in subtitles, WebP clips, poster, script.md; then copy them next to this folder
python3 -B "$SRC/finish.py"
python3 -B "$SRC/script.py"
cp "$W"/out/final/{walkthrough.mp4,walkthrough_subtitled.mp4,voiceover.wav,subtitles.srt,walkthrough-poster.jpg,clip-make-course.webp,clip-visuals.webp,clip-study.webp,clip-make-it-yours.webp} "$REPO/assets/media/"
echo "Done: $REPO/assets/media"
