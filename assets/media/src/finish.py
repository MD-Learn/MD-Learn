"""Final deliverables from the render: master MP4, SRT, burned-in subtitles, GIF clips and the GIF preview for the README.

Reads out/walkthrough-raw.mp4 (HyperFrames render), compose/project/media/voiceover.wav and timings.json.
Writes everything to out/final/.
"""
import json
import os
import subprocess
import textwrap
from pathlib import Path

HERE = Path(os.environ.get("WALKTHROUGH_WORK", Path.home() / ".cache/mdlearn-walkthrough"))
OUT = HERE / "out/final"
MEDIA = HERE / "compose/project/media"
RAW = HERE / "out/walkthrough-raw.mp4"
T = json.loads((HERE / "timings.json").read_text())
MAX_LINE = 42
ASS_BREAK = "\\N"   # a line break inside an ASS dialogue line


def run(*args: str) -> None:
    subprocess.run(args, check=True)


def events() -> list[tuple[float, float, list[str]]]:
    """Subtitle events: one per cue, split in two when it needs more than two lines of MAX_LINE characters."""
    out = []
    for scene in T["scenes"]:
        for c in scene["cues"]:
            lines = textwrap.wrap(c["text"], MAX_LINE)
            if len(lines) <= 2:
                out.append((c["start"], c["end"], lines))
                continue
            words = c["text"].split()
            # split at the clause break nearest the middle, timed by share of characters
            best = min(range(1, len(words)), key=lambda i: (abs(len(" ".join(words[:i])) - len(c["text"]) / 2) - (24 if words[i - 1][-1] in ",.:;" else 0)))
            a, b = " ".join(words[:best]), " ".join(words[best:])
            mid = c["start"] + (c["end"] - c["start"]) * len(a) / (len(a) + len(b))
            out.append((c["start"], mid, textwrap.wrap(a, MAX_LINE)))
            out.append((mid, c["end"], textwrap.wrap(b, MAX_LINE)))
    return out


def ts(t: float, sep: str = ",") -> str:
    ms = round(t * 1000)
    h, ms = divmod(ms, 3_600_000)
    m, ms = divmod(ms, 60_000)
    s, ms = divmod(ms, 1000)
    return f"{h:02d}:{m:02d}:{s:02d}{sep}{ms:03d}"


def ass_ts(t: float) -> str:
    cs = round(t * 100)
    h, cs = divmod(cs, 360_000)
    m, cs = divmod(cs, 6000)
    s, cs = divmod(cs, 100)
    return f"{h}:{m:02d}:{s:02d}.{cs:02d}"


def subtitles(ev: list[tuple[float, float, list[str]]]) -> None:
    srt = [f"{i}\n{ts(a)} --> {ts(b)}\n" + "\n".join(lines) + "\n" for i, (a, b, lines) in enumerate(ev, 1)]
    (OUT / "subtitles.srt").write_text("\n".join(srt))
    # high contrast for autoplay on phones: white semibold sans on a 75% black box, clear of the bottom edge
    head = """[Script Info]
ScriptType: v4.00+
PlayResX: 1920
PlayResY: 1080
WrapStyle: 2
ScaledBorderAndShadow: yes

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Sub,Noto Sans SemiBold,46,&H00FFFFFF,&H00FFFFFF,&H40141414,&H40141414,0,0,0,0,100,100,0.2,0,3,14,0,2,160,160,44,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
"""
    body = [f"Dialogue: 0,{ass_ts(a)},{ass_ts(b)},Sub,,0,0,0,,{ASS_BREAK.join(lines)}" for a, b, lines in ev]
    (OUT / "subtitles.ass").write_text(head + "\n".join(body) + "\n")


def master() -> None:
    run("ffmpeg", "-v", "error", "-y", "-i", str(RAW), "-i", str(MEDIA / "voiceover.wav"), "-map", "0:v", "-map", "1:a",
        "-c:v", "copy", "-c:a", "aac", "-b:a", "160k", "-ar", "48000", "-shortest", "-movflags", "+faststart", str(OUT / "walkthrough.mp4"))
    run("ffmpeg", "-v", "error", "-y", "-i", str(OUT / "walkthrough.mp4"), "-vf", f"ass={OUT / 'subtitles.ass'}:fontsdir=/usr/share/fonts/noto",
        "-c:v", "libx264", "-preset", "slow", "-crf", "19", "-pix_fmt", "yuv420p", "-c:a", "copy", "-movflags", "+faststart", str(OUT / "walkthrough_subtitled.mp4"))
    run("cp", str(MEDIA / "voiceover.wav"), str(OUT / "voiceover.wav"))


# GIF, not video or WebP: GitHub's README shows no <video> for files in the repo, and a GIF plays everywhere, the
# GitHub app included. One palette per GIF; only the changed part of each frame is re-dithered, so UI stays small.
GIF_PALETTE = "split[a][b];[a]palettegen=max_colors=192:stats_mode=diff[p];[b][p]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle[out]"


def clip(name: str, pieces: list[str], fps: int = 12, width: int = 960) -> None:
    """A looping GIF from consecutive UI pieces (native 1080p footage), for the README."""
    durs = {x["name"]: x["dur"] for x in json.loads((HERE / "pieces.json").read_text())}
    inputs, chain = [], []
    for i, p in enumerate(pieces):
        inputs += ["-i", str(MEDIA / f"{p}.mp4")]
        chain.append(f"[{i}:v]trim=duration={durs[p] - 0.35:.3f},setpts=PTS-STARTPTS[p{i}]")
    graph = ";".join(chain) + ";" + "".join(f"[p{i}]" for i in range(len(pieces))) + f"concat=n={len(pieces)}:v=1:a=0,fps={fps},scale={width}:-2:flags=lanczos," + GIF_PALETTE
    run("ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", "[out]", "-loop", "0", str(OUT / f"{name}.gif"))


def preview() -> None:
    """The README hero: about 30 s of the finished video, scene by scene, as a looping GIF."""
    def at(scene: str, offset: float = 0.0) -> float:
        return next(s["start"] for s in T["scenes"] if s["id"] == scene) + offset
    cues = {c["n"]: c["start"] for s in T["scenes"] for c in s["cues"]}
    pieces = {x["name"]: x for x in json.loads((HERE / "pieces.json").read_text())}
    def piece(n: str, a: float = 0.0, length: float | None = None) -> tuple[float, float]:
        start = pieces[n]["start"] + a
        return start, start + (length if length is not None else pieces[n]["dur"] - 0.35 - a)
    cuts = [(at("what", 0.25), at("what", 2.45)),           # the title card
            piece("m1", 1.2, 3.4), piece("m5", 0.0, 2.7),     # a course is made; its notes appear
            (cues[16] + 1.35, at("features") - 0.4),          # the diagram, complete
            piece("f2"), piece("f3", 0.0, 2.4), piece("f4", 0.2, 5.6),
            piece("y1", 0.15, 3.2), piece("y3b", 0.0, 2.9), piece("y4b", 0.05, 3.4)]
    chain = [f"[0:v]trim=start={a:.3f}:end={b:.3f},setpts=PTS-STARTPTS[s{i}]" for i, (a, b) in enumerate(cuts)]
    graph = ";".join(chain) + ";" + "".join(f"[s{i}]" for i in range(len(cuts))) + f"concat=n={len(cuts)}:v=1:a=0,fps=12,scale=960:-2:flags=lanczos," + GIF_PALETTE
    run("ffmpeg", "-v", "error", "-y", "-i", str(OUT / "walkthrough.mp4"), "-filter_complex", graph, "-map", "[out]", "-loop", "0", str(OUT / "walkthrough-preview.gif"))


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ev = events()
    subtitles(ev)
    master()
    clip("clip-make-course", ["m1", "m2", "m3", "m4a", "m4b", "m5"])
    clip("clip-visuals", ["f1", "f2", "f3"])
    clip("clip-study", ["f4", "f5"])
    clip("clip-make-it-yours", ["y1", "y2", "y3a", "y3b", "y4a", "y4b"])
    preview()
    print(f"{len(ev)} subtitle events")


if __name__ == "__main__":
    main()
