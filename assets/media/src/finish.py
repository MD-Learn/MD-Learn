"""Final deliverables from the render: master MP4, SRT, burned-in subtitles, doc clips and the poster.

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


def clip(name: str, pieces: list[str], fps: int = 12, width: int = 960, q: int = 85) -> None:
    """A looping animated WebP from consecutive UI pieces (native 1080p footage), for the README."""
    durations = {x["name"]: x["dur"] for x in json.loads((HERE / "pieces.json").read_text())}
    inputs, chain = [], []
    for i, p in enumerate(pieces):
        inputs += ["-i", str(MEDIA / f"{p}.mp4")]
        # each piece carries a cross-fade tail in the video; the clip drops it so the cuts are clean
        chain.append(f"[{i}:v]trim=duration={durations[p] - 0.35:.3f},setpts=PTS-STARTPTS[p{i}]")
    graph = ";".join(chain) + ";" + "".join(f"[p{i}]" for i in range(len(pieces))) + f"concat=n={len(pieces)}:v=1:a=0,fps={fps},scale={width}:-2:flags=lanczos[out]"
    run("ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", graph, "-map", "[out]", "-c:v", "libwebp_anim", "-lossless", "0",
        "-q:v", str(q), "-compression_level", "6", "-loop", "0", "-an", str(OUT / f"{name}.webp"))


def poster() -> None:
    """The README hero: a frame of the Read step (a plot with its slider) with a play button."""
    frame = OUT / "poster-frame.png"
    run("ffmpeg", "-v", "error", "-y", "-ss", "76.2", "-i", str(OUT / "walkthrough.mp4"), "-frames:v", "1", str(frame))
    run("magick", str(frame), "-resize", "1280x720",
        "-fill", "rgba(38,38,36,0.86)", "-draw", "circle 640,360 640,412",
        "-fill", "white", "-draw", "polygon 624,334 624,386 666,360",
        "-quality", "88", str(OUT / "walkthrough-poster.jpg"))
    frame.unlink()


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    ev = events()
    subtitles(ev)
    master()
    clip("clip-make-course", ["m1", "m2", "m3", "m4a", "m4b", "m5"])
    clip("clip-visuals", ["f1", "f2", "f3"])
    clip("clip-study", ["f4", "f5"])
    clip("clip-make-it-yours", ["y1", "y2", "y3a", "y3b", "y4a", "y4b"])
    poster()
    print(f"{len(ev)} subtitle events")


if __name__ == "__main__":
    main()
