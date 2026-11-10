"""Write ../script.md, the walkthrough's script, from cues.json and the voice timings (timings.json from tts.py).

The spoken lines and their times come from those files; what is on screen in each scene is described here.
"""
import json
import os
from pathlib import Path

SRC = Path(__file__).resolve().parent
WORK = Path(os.environ.get("WALKTHROUGH_WORK", Path.home() / ".cache/mdlearn-walkthrough"))

HEADINGS = {
    "hook": "Hook: the problem",
    "what": "What MDlearn is",
    "make": "Core workflow: make a course",
    "engine": "Under the hood",
    "features": "Key features in action",
    "yours": "Key features: make it yours",
    "start": "Wrap-up and getting started",
}

ON_SCREEN = {
    "hook": "Three class files drop in (Lecture 3.pptx, Handout 2.docx, my-notes.md). A \"What you remember\" curve draws "
            "itself and falls from \"the night before\" to \"a week later\". Then the line *Being tested does more for memory "
            "than reading again.*, with its sources (Adesope et al., 2017; Agarwal et al., 2021, as cited in "
            "`docs/PEDAGOGICAL_SPEC.md`).",
    "what": "Title card: the MDlearn mark and one line. Then live Studio in a smaller window: the first page, with three notes "
            "beside it, one per spoken idea (an AI you already use, a strict compiler, spaced repetition). On the last line, "
            "the note `02-the-carnot-limit.md` switches to its Markdown source: *Plain Markdown · On your computer · No account*.",
    "make": "Step label **1 Make a course**. Live Studio: the topic \"Heat engines\" is typed; `Lecture 3.pptx` and "
            "`Handout 2.docx` are added; *What was read* lists what came out of each; the course form (What for → Understand "
            "it); *Who writes the course?* → My coding assistant → Get the folder ready, which prints the command to run; the "
            "notes appear in the folder as they are written.",
    "engine": "\"Under the hood\". Left: the Markdown of a note with its `:::quiz` and `:::plot` blocks highlighted, then a "
              "terminal with the real output of `mdlearn lint .` on a copy with a broken quiz (`E202 quiz-no-correct`) and on "
              "the fixed course (0 errors), and the note that such a question is locked in the app. Right, building with the "
              "narration: Markdown notes → the compiler (`@mdlearn/core`: parse, validate, lint) → Studio · CLI · MCP server → "
              "FSRS scheduler with `progress.json`.",
    "features": "Step labels **2 Read**, **3 Study**, **4 Today**. Live Studio on *The Carnot limit*: the formula block with "
                "each term lit as the cursor passes; the plot's cold-reservoir slider dragged and the curve moving; the "
                "four-step Carnot animation stepped through. Then Study: the first card answered, *Were you sure?* → Yes, sure "
                "→ *Right*. Then Today: 5 new, about 6 minutes, the next 7 days.",
    "yours": "Step label **5 Make it yours**. The Aa menu: the reading font goes from Serif to *Easy to read*, one size up. "
             "\"from cold to hot\" is selected and highlighted in yellow. Then *That never happens, so no engine can beat the "
             "reversible one.* is selected → **Explain**: the answer of a local model (qwen3:8b through Ollama, on this "
             "computer) streams into the notes column beside the passage, in a close-up. Then **Pixel**, the companion in the "
             "sidebar (ringed, \"grows as you study\", Lv 1), opens *Ask about your course*; \"Why must the Carnot formula use "
             "kelvin?\" is typed and the answer streams with numbered sources from the course. Both answers are real and "
             "shown about twice as fast as they arrived.",
    "start": "End card: `$ npx mdlearn studio`, \"or download the desktop app for Windows, macOS and Linux\", \"Open source · "
             "MIT licence\", **github.com/teo-clerk/MDlearn**, \"Issues and pull requests are welcome.\"",
}

PRODUCTION = """## Production

| Step | Tool | Notes |
|---|---|---|
| Voice | [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) 0.6.1, voice `af_heart`, speed 0.95 | Offline on the CPU. One WAV per line; the measured lengths set every scene's timing. Normalised to −16 LUFS (two-pass `loudnorm`), 0.5 s of silence at each end. Checked by transcribing it with faster-whisper `base.en`. |
| UI footage | Playwright + the Chrome DevTools screencast | MDlearn Studio from `packages/studio/dist`, on a temporary library with its own settings file. 1280×720 viewport at device scale 1.5, so frames are native 1920×1080. A drawn cursor, eased mouse moves; every step rehearsed before recording. |
| AI answers | [Ollama](https://ollama.com) with `qwen3:8b`, on this computer | Explain and the companion answer for real; nothing is staged. |
| Composition | [HyperFrames](https://github.com/heygen-com/hyperframes) 0.8.209 + GSAP 3.15.0 | One HTML composition (`build.py` writes it): the UI pieces, the HTML scenes and the voice, rendered frame by frame at 30 fps. Telemetry off (`DO_NOT_TRACK=1`). |
| Subtitles and GIFs | FFmpeg 9 (libx264, libass) | SRT from the line timings; burned in as ASS (Noto Sans SemiBold 46 px, white on a 75% black box). The README GIFs are cut from the native footage, one palette each. |
"""


def clock(t: float) -> str:
    m, s = divmod(t, 60)
    return f"{int(m)}:{s:04.1f}"


def main() -> None:
    timings = json.loads((WORK / "timings.json").read_text())
    cues = json.loads((SRC / "cues.json").read_text())
    spoken = {c["n"]: c["text"] for c in (c for s in timings["scenes"] for c in s["cues"])}
    scenes = timings["scenes"]
    out = [
        "# MDlearn walkthrough: script",
        "",
        f"A {round(timings['duration'])}-second, 16:9 walkthrough of MDlearn. The voice is Kokoro (`{cues['voice']}`), "
        "synthesised offline; every UI shot is a real recording of MDlearn Studio running on a throw-away folder, and the "
        "course on screen is the three-note *Heat engines* course in [`src/demo-course/`](src/demo-course/), written for the "
        "video and clean under `mdlearn lint` (0 errors, 0 warnings).",
        "",
        "Times are those of the finished video (`walkthrough.mp4`). Each scene lists what is said and what is on screen. The "
        "spoken lines are the subtitles; [`src/cues.json`](src/cues.json) also holds the spelling given to the voice "
        "(\"M D learn\", \"F S R S\"), and [`src/build.sh`](src/build.sh) rebuilds everything from it, this file included.",
    ]
    for i, s in enumerate(scenes):
        end = scenes[i + 1]["start"] if i + 1 < len(scenes) else timings["duration"]
        out += ["", f"## {clock(s['start'])}–{clock(end)} · {HEADINGS[s['id']]}", "", f"**On screen.** {ON_SCREEN[s['id']]}", "",
                "| Time | Voiceover |", "|---|---|"]
        out += [f"| {clock(c['start'])} | {spoken[c['n']]} |" for c in s["cues"]]
    out += ["", PRODUCTION]
    (SRC.parent / "script.md").write_text("\n".join(out))
    print(f"script.md: {len(scenes)} scenes, {timings['duration']:.1f} s")


if __name__ == "__main__":
    main()
