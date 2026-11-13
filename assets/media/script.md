# MDlearn walkthrough: script

A 120-second, 16:9 walkthrough of MDlearn. The voice is Kokoro (`af_heart`), synthesised offline; every UI shot is a real recording of MDlearn Studio running on a throw-away folder, and the course on screen is the three-note *Heat engines* course in [`src/demo-course/`](src/demo-course/), written for the video and clean under `mdlearn lint` (0 errors, 0 warnings).

Times are those of the finished video (`walkthrough.mp4`). Each scene lists what is said and what is on screen. The spoken lines are the subtitles; [`src/cues.json`](src/cues.json) also holds the spelling given to the voice ("M D learn", "F S R S"), and [`src/build.sh`](src/build.sh) rebuilds everything from it, this file included.

## 0:00.5–0:12.8 · Hook: the problem

**On screen.** Three class files drop in (Lecture 3.pptx, Handout 2.docx, my-notes.md). A "What you remember" curve draws itself and falls from "the night before" to "a week later". Then the line *Being tested does more for memory than reading again.*, with its sources (Adesope et al., 2017; Agarwal et al., 2021, as cited in `docs/PEDAGOGICAL_SPEC.md`).

| Time | Voiceover |
|---|---|
| 0:00.5 | You have the slides, the handouts, and a folder of notes. |
| 0:03.7 | You reread them before the exam, and a week later most of it is gone. |
| 0:08.2 | Being tested on something does more for memory than reading it again. |

## 0:12.8–0:32.8 · What MDlearn is

**On screen.** Title card: the MDlearn mark and one line. Then live Studio in a smaller window: the first page, with three notes beside it, one per spoken idea (an AI you already use, a strict compiler, spaced repetition). On the last line, the note `02-the-carnot-limit.md` switches to its Markdown source: *Plain Markdown · On your computer · No account*.

| Time | Voiceover |
|---|---|
| 0:12.8 | MDlearn turns your class files, or just a topic, into better notes you can study. |
| 0:18.4 | An AI you already use writes them, a strict compiler checks them, |
| 0:22.7 | and spaced repetition brings each idea back just before you'd forget it. |
| 0:27.3 | It runs on your computer, with no account. Your notes are plain Markdown files. |

## 0:32.8–0:51.0 · Core workflow: make a course

**On screen.** Step label **1 Make a course**. Live Studio: the topic "Heat engines" is typed; `Lecture 3.pptx` and `Handout 2.docx` are added; *What was read* lists what came out of each; the course form (What for → Understand it); *Who writes the course?* → My coding assistant → Get the folder ready, which prints the command to run; the notes appear in the folder as they are written.

| Time | Voiceover |
|---|---|
| 0:32.8 | Say what you want to learn, and add any PDFs, slides or Word files. |
| 0:38.0 | MDlearn shows what it could read from each one. |
| 0:41.3 | Choose the kind of course you want, |
| 0:43.4 | and who writes it: Claude from here, your coding assistant, or a chat. |
| 0:48.1 | The notes appear as they are written. |

## 0:51.0–1:11.4 · Under the hood

**On screen.** "Under the hood". Left: the Markdown of a note with its `:::quiz` and `:::plot` blocks highlighted, then a terminal with the real output of `mdlearn lint .` on a copy with a broken quiz (`E202 quiz-no-correct`) and on the fixed course (0 errors), and the note that such a question is locked in the app. Right, building with the narration: Markdown notes → the compiler (`@mdlearn/core`: parse, validate, lint) → Studio · CLI · MCP server → FSRS scheduler with `progress.json`.

| Time | Voiceover |
|---|---|
| 0:51.0 | Under the hood, every note is Markdown, with blocks for questions and plots. |
| 0:55.8 | The compiler checks every block. A broken question is locked, never shown. |
| 1:00.6 | One core runs the app, the command line, and an MCP server for AI assistants. |
| 1:06.1 | Your answers feed an FSRS scheduler, kept in one file on your disk. |

## 1:11.4–1:29.2 · Key features in action

**On screen.** Step labels **2 Read**, **3 Study**, **4 Today**. Live Studio on *The Carnot limit*: the formula block with each term lit as the cursor passes; the plot's cold-reservoir slider dragged and the curve moving; the four-step Carnot animation stepped through. Then Study: the first card answered, *Were you sure?* → Yes, sure → *Right*. Then Today: 5 new, about 6 minutes, the next 7 days.

| Time | Voiceover |
|---|---|
| 1:11.4 | Formulas are explained term by term, in colour. |
| 1:15.0 | Plots have sliders, and derivations play one step at a time. |
| 1:19.7 | When you study, you answer, then say whether you were sure, so lucky guesses come back sooner. |
| 1:25.7 | Today plans a short session for each day. |

## 1:29.2–1:47.8 · Key features: make it yours

**On screen.** Step label **5 Make it yours**. The Aa menu: the reading font goes from Serif to *Easy to read*, one size up. "from cold to hot" is selected and highlighted in yellow. Then *That never happens, so no engine can beat the reversible one.* is selected → **Explain**: the answer of a local model (qwen3:8b through Ollama, on this computer) streams into the notes column beside the passage, in a close-up. Then **Pixel**, the companion in the sidebar (ringed, "grows as you study", Lv 1), opens *Ask about your course*; "Why must the Carnot formula use kelvin?" is typed and the answer streams with numbered sources from the course. Both answers are real and shown about twice as fast as they arrived.

| Time | Voiceover |
|---|---|
| 1:29.2 | Make it yours: pick the reading font and size, |
| 1:32.3 | and highlight in colour, right in the text. |
| 1:35.2 | Select a passage, and an AI explains it beside the text. |
| 1:40.3 | And Pixel, your study companion, grows as you study and answers your questions, with sources. |

## 1:47.8–1:59.9 · Wrap-up and getting started

**On screen.** End card: `$ npx mdlearn studio`, "or download the desktop app for Windows, macOS and Linux", "Open source · MIT licence", **github.com/MD-Learn/MD-Learn**, "Issues and pull requests are welcome."

| Time | Voiceover |
|---|---|
| 1:47.8 | Download the desktop app, or run npx mdlearn studio. |
| 1:52.4 | It's open source, under the MIT licence. Find it on GitHub; issues and pull requests are welcome. |

## Production

| Step | Tool | Notes |
|---|---|---|
| Voice | [kokoro-onnx](https://github.com/thewh1teagle/kokoro-onnx) 0.6.1, voice `af_heart`, speed 0.95 | Offline on the CPU. One WAV per line; the measured lengths set every scene's timing. Normalised to −16 LUFS (two-pass `loudnorm`), 0.5 s of silence at each end. Checked by transcribing it with faster-whisper `base.en`. |
| UI footage | Playwright + the Chrome DevTools screencast | MDlearn Studio from `packages/studio/dist`, on a temporary library with its own settings file. 1280×720 viewport at device scale 1.5, so frames are native 1920×1080. A drawn cursor, eased mouse moves; every step rehearsed before recording. |
| AI answers | [Ollama](https://ollama.com) with `qwen3:8b`, on this computer | Explain and the companion answer for real; nothing is staged. |
| Composition | [HyperFrames](https://github.com/heygen-com/hyperframes) 0.8.209 + GSAP 3.15.0 | One HTML composition (`build.py` writes it): the UI pieces, the HTML scenes and the voice, rendered frame by frame at 30 fps. Telemetry off (`DO_NOT_TRACK=1`). |
| Subtitles and GIFs | FFmpeg 9 (libx264, libass) | SRT from the line timings; burned in as ASS (Noto Sans SemiBold 46 px, white on a 75% black box). The README GIFs are cut from the native footage, one palette each. |
