"""Build the walkthrough composition from the voiceover timings and the recorded UI segments.

1. Normalises the voiceover to -16 LUFS (two-pass loudnorm) -> compose/project/media/voiceover.wav
2. Cuts each UI piece from capture/segments at the speed that fits its narration window
3. Writes compose/project/index.html, a HyperFrames composition (1920x1080, 30 fps)

Render with:  npx hyperframes render compose/project -o out/walkthrough-raw.mp4
"""
import json
import os
import shutil
import subprocess
from html import escape
from pathlib import Path

HERE = Path(os.environ.get("WALKTHROUGH_WORK", Path.home() / ".cache/mdlearn-walkthrough"))
SEG = HERE / "capture/segments"
PROJ = HERE / "compose/project"
MEDIA = PROJ / "media"
REPO = Path(__file__).resolve().parents[3]   # assets/media/src -> the repository
XF = 0.35          # cross-fade between pieces and scenes (s)
W, H = 1920, 1080
WIN = dict(x=192, y=66, w=1536, h=864)   # the UI window, 0.8 of full size
SPLIT = dict(x=80, y=180, w=1280, h=720)  # a smaller window with notes beside it (2/3 size)

T = json.loads((HERE / "timings.json").read_text())
CUES = {c["n"]: c for s in T["scenes"] for c in s["cues"]}
SCENES = {s["id"]: s for s in T["scenes"]}
END = T["duration"]


def cue(n: int) -> float:
    return CUES[n]["start"]


def run(*args: str) -> str:
    return subprocess.run(args, check=True, capture_output=True, text=True).stderr


# ---------- 1. voiceover ----------
def voiceover() -> None:
    raw = str(HERE / "tts/master-raw.wav")
    first = run("ffmpeg", "-hide_banner", "-i", raw, "-af", "loudnorm=I=-16:TP=-1.5:LRA=11:print_format=json", "-f", "null", "-")
    m = json.loads(first[first.rindex("{"):first.rindex("}") + 1])
    af = (f"loudnorm=I=-16:TP=-1.5:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:"
          f"measured_LRA={m['input_lra']}:measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true")
    run("ffmpeg", "-y", "-i", raw, "-af", af, "-ar", "48000", "-ac", "1", str(MEDIA / "voiceover.wav"))


# ---------- 2. UI pieces ----------
# (name, segment, source in, source out, start in the video, end in the video[, crop x, y, w, h in source pixels])
PIECES = [
    ("home", "home", 0.4, 11.9, cue(5), cue(7)),
    ("source", "source", 0.3, 8.6, cue(7), SCENES["make"]["start"]),
    ("m1", "course", 0.3, 8.3, cue(8), cue(9)),
    ("m2", "course", 8.3, 11.9, cue(9), cue(10)),
    ("m3", "course", 12.6, 15.9, cue(10), cue(11)),
    ("m4a", "course", 16.6, 21.9, cue(11), cue(12) - 1.07),
    ("m4b", "course", 26.6, 27.7, cue(12) - 1.07, cue(12)),
    ("m5", "course", 31.7, 36.4, cue(12), SCENES["engine"]["start"]),
    ("f1", "features", 0.5, 5.4, cue(17), cue(18)),
    ("f2", "features", 7.6, 10.6, cue(18), cue(18) + (cue(19) - cue(18)) * 3.0 / 6.6),
    ("f3", "features", 21.0, 24.6, cue(18) + (cue(19) - cue(18)) * 3.0 / 6.6, cue(19)),
    ("f4", "features", 29.0, 36.4, cue(19), cue(20)),
    ("f5", "features", 38.9, 43.0, cue(20), SCENES["yours"]["start"]),
]


def yours_pieces() -> list[tuple]:
    """The "make it yours" scene, cut at the recording's marks. Clicks run near real time; the AI's answers stream
    faster, in a close-up on the answer. The pieces share the scene's time in proportion to that."""
    m = {x["name"]: x["t"] for x in json.loads((SEG / "yours.marks.json").read_text())["marks"]}
    explain_zoom, pixel_zoom, companion_zoom = (448, 190, 1472, 828), (0, 270, 1440, 810), (0, 120, 1440, 810)
    plan = [("y1", 0.3, m["highlight"], 1.4, None), ("y2", m["highlight"], m["explain"], 1.45, None),
            ("y3a", m["explain"], m["explain-asked"], 1.4, None), ("y3b", m["explain-asked"], m["explain-done"] + 0.6, 2.1, explain_zoom),
            ("y4a", m["companion"], m["companion-asked"], 1.4, pixel_zoom), ("y4b", m["companion-asked"], m["companion-done"] + 1.4, 2.2, companion_zoom)]
    t0, t1 = SCENES["yours"]["start"], SCENES["start"]["start"]
    want = [(b - a) / sp for _, a, b, sp, _ in plan]
    k, t, out = (t1 - t0) / sum(want), t0, []
    for (name, a, b, _, crop), w in zip(plan, want):
        out.append((name, "yours", a, b, t, t + w * k, *(crop or ())))
        t += w * k
    return out


def cut_pieces() -> list[dict]:
    out = []
    for name, seg, a, b, t0, t1, *crop in PIECES + yours_pieces():
        dst = (t1 - t0) + XF                     # each piece overlaps the next one by XF, for the cross-fade
        speed = (b - a) / (t1 - t0)
        src_len = dst * speed
        seg_len = json.loads((SEG / f"{seg}.marks.json").read_text())["duration"]
        hold = max(0.0, a + src_len - seg_len)   # past the end of the recording: hold the last frame
        vf = f"trim=start={a:.3f}:duration={src_len - hold:.3f},setpts=(PTS-STARTPTS)/{speed:.5f},tpad=stop_mode=clone:stop_duration={hold / speed + 0.1:.3f},fps=30"
        if crop:   # a close-up: this part of the window, scaled back to full size
            vf += f",crop={crop[2]}:{crop[3]}:{crop[0]}:{crop[1]},scale=1920:1080:flags=lanczos"
        run("ffmpeg", "-y", "-i", str(SEG / f"{seg}.mp4"), "-vf", vf, "-t", f"{dst:.3f}", "-an",
            "-c:v", "libx264", "-preset", "slow", "-crf", "12", "-pix_fmt", "yuv420p", str(MEDIA / f"{name}.mp4"))
        out.append({"name": name, "start": round(t0, 3), "dur": round(dst, 3), "speed": round(speed, 2)})
        print(f"  {name:6s} {t0:7.2f}-{t1:7.2f}  x{speed:.2f}")
    return out


# ---------- 3. composition ----------
LOGO = ('<svg viewBox="0 0 32 32" aria-hidden="true"><rect width="32" height="32" rx="7" fill="#2c2c2b"/>'
        '<path d="M8 22V10l5 6 5-6v12" fill="none" stroke="#fff" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>'
        '<path d="M21.5 12.5h3M21.5 16h3M21.5 19.5h3" stroke="#fff" stroke-width="2" stroke-linecap="round"/></svg>')

CSS = """
@font-face { font-family: 'Source Serif 4'; src: url(media/serif.woff2) format('woff2'); font-weight: 200 900; font-style: normal; }
@font-face { font-family: 'Source Serif 4'; src: url(media/serif-italic.woff2) format('woff2'); font-weight: 200 900; font-style: italic; }
@font-face { font-family: 'Noto Sans'; src: url(media/sans-400.ttf); font-weight: 400; }
@font-face { font-family: 'Noto Sans'; src: url(media/sans-500.ttf); font-weight: 500; }
@font-face { font-family: 'Noto Sans'; src: url(media/sans-600.ttf); font-weight: 600 700; }
@font-face { font-family: 'JetBrains Mono'; src: url(media/mono-400.ttf); font-weight: 400 700; }
:root { --page:#fbfbfa; --paper:#f4f4f1; --ink:#2c2c2b; --muted:#6f6e6a; --subtle:#8a8984; --hair:#e3e2de; --hair2:#d6d5d1;
  --amber:#a8650a; --amber-bg:rgb(214 170 40 / .20); --blue:#2f5fae; --green:#2c7a4b; --rose:#b23a4f; --violet:#6a46b8;
  --serif:'Source Serif 4', Georgia, serif; --sans:'Noto Sans', sans-serif; --mono:'JetBrains Mono', monospace; }
html, body { margin:0; background:var(--paper); }
#root { position:relative; width:1920px; height:1080px; overflow:hidden; background:var(--paper); color:var(--ink); font-family:var(--sans); }
.clip { position:absolute; left:0; top:0; width:1920px; height:1080px; }
.scene { background:var(--page); }
.ui { position:absolute; border-radius:14px; }
.frame { background:#fff; border:1px solid var(--hair2); box-shadow:0 1px 2px rgb(40 38 33 / .06), 0 24px 60px rgb(40 38 33 / .13); }
video.ui { object-fit:cover; clip-path: inset(0 round 14px); }
.chip { position:absolute; left:192px; top:18px; display:flex; align-items:center; gap:12px; font-size:23px; color:var(--ink); font-weight:500; }
.chip b { display:inline-grid; place-items:center; width:32px; height:32px; border-radius:50%; background:var(--ink); color:#fff; font-size:17px; font-weight:600; }
.brand { position:absolute; right:192px; top:20px; display:flex; align-items:center; gap:10px; font-size:21px; color:var(--muted); }
.brand svg { width:28px; height:28px; }
.card { position:absolute; background:#fff; border:1px solid var(--hair); border-radius:16px; box-shadow:0 1px 2px rgb(40 38 33 / .05), 0 14px 36px rgb(40 38 33 / .09); }
.h-kicker { font-size:24px; color:var(--muted); }
.serif { font-family:var(--serif); }
.mono { font-family:var(--mono); }
/* hook */
.file { width:520px; height:118px; display:flex; align-items:center; gap:26px; padding:0 30px; box-sizing:border-box; }
.file .ext { width:74px; height:86px; border-radius:10px; display:grid; place-items:center; font-size:18px; font-weight:700; letter-spacing:.04em; color:#fff; }
.file .name { font-size:30px; font-weight:500; }
.file .meta { font-size:21px; color:var(--muted); margin-top:4px; }
.axis { position:absolute; background:var(--hair2); }
/* engine */
.node { position:absolute; left:980px; width:820px; box-sizing:border-box; padding:22px 30px; }
.node .t { font-size:31px; font-weight:600; }
.node .s { font-size:21px; color:var(--muted); margin-top:6px; }
.pill { display:inline-block; padding:8px 20px; margin-right:12px; border-radius:999px; border:1.5px solid var(--hair2); font-size:22px; color:var(--muted); }
.pill.on { background:var(--ink); border-color:var(--ink); color:#fff; }
.arrow { position:absolute; left:1384px; width:2px; height:34px; background:var(--hair2); }
.arrow::after { content:''; position:absolute; left:-7px; bottom:-2px; border:8px solid transparent; border-top:10px solid var(--hair2); border-bottom:0; }
.code { font-family:var(--mono); font-size:24px; line-height:1.5; color:#3b3a37; }
.code > div > div > div { white-space:pre; }
.code > div[id^=tm] { white-space:pre-wrap; line-height:32px; margin-bottom:4px; }
.code .d { color:var(--violet); font-weight:600; }
.code div { line-height:33px; }
.code, .mono { font-variant-ligatures:none; font-feature-settings:"liga" 0, "calt" 0; }
.code .k { color:var(--muted); }
.term { background:#262624; color:#e7e6e2; }
.term .p { color:#9cc59a; }
.term .e { color:#f08a7a; }
.term .ok { color:#9cc59a; }
.mark { position:absolute; left:0; right:0; height:36px; background:var(--amber-bg); border-radius:6px; }
"""


def esc(s: str) -> str:
    return escape(s, quote=True)


class Comp:
    def __init__(self) -> None:
        self.parts: list[str] = []
        self.js: list[str] = []
        self.z = 10
        self.n = 0

    def id(self, p: str) -> str:
        self.n += 1
        return f"{p}{self.n}"

    def clip(self, start: float, dur: float, inner: str, cls: str = "", fade: bool = True, style: str = "") -> str:
        cid = self.id("c")
        self.z += 1
        self.parts.append(f'<div id="{cid}" class="clip {cls}" data-start="{start:.3f}" data-duration="{dur:.3f}" style="z-index:{self.z};{style}">{inner}</div>')
        if fade:
            self.js.append(f"tl.fromTo('#{cid}', {{opacity:0}}, {{opacity:1, duration:{XF}, ease:'none'}}, {start:.3f});")
        return cid

    def video(self, start: float, dur: float, src: str, fade: bool = True, r: dict = WIN) -> None:
        vid = self.id("v")
        self.z += 1
        self.parts.append(f'<video id="{vid}" class="clip ui" data-start="{start:.3f}" data-duration="{dur:.3f}" src="media/{src}" muted playsinline '
                          f'style="z-index:{self.z};left:{r["x"]}px;top:{r["y"]}px;width:{r["w"]}px;height:{r["h"]}px"></video>')
        if fade:
            self.js.append(f"tl.fromTo('#{vid}', {{opacity:0}}, {{opacity:1, duration:{XF}, ease:'none'}}, {start:.3f});")

    def show(self, sel: str, t: float, dur: float = 0.5, y: int = 18) -> None:
        self.js.append(f"tl.fromTo('{sel}', {{opacity:0, y:{y}}}, {{opacity:1, y:0, duration:{dur}, ease:'power2.out'}}, {t:.3f});")

    def hide(self, sel: str, t: float, dur: float = 0.35, to: float = 0) -> None:
        self.js.append(f"tl.to('{sel}', {{opacity:{to}, duration:{dur}, ease:'power1.inOut'}}, {t:.3f});")

    def grow(self, sel: str, t: float, dur: float, width: int) -> None:
        self.js.append(f"tl.fromTo('{sel}', {{width:0}}, {{width:{width}, duration:{dur}, ease:'power1.inOut'}}, {t:.3f});")

    def cls_on(self, sel: str, t: float) -> None:
        # a class switch at an exact time, seekable both ways
        self.js.append(f"tl.call(() => document.querySelector('{sel}').classList.add('on'), [], {t:.3f});"
                       f"tl.call(() => document.querySelector('{sel}').classList.remove('on'), [], {t - 0.001:.3f});")


def hook(c: Comp) -> None:
    s = SCENES["hook"]
    files = [("PPTX", "#b7472a", "Lecture 3.pptx", "Thermodynamics, week 3"), ("DOCX", "#2b579a", "Handout 2.docx", "The first law, efficiency"),
             ("MD", "#2c2c2b", "my-notes.md", "Written the night before")]
    inner = []
    for i, (ext, col, name, meta) in enumerate(files):
        inner.append(f'<div id="hf{i}" class="card file" style="left:{150 + i * 34}px;top:{240 + i * 150}px">'
                     f'<div class="ext" style="background:{col}">{ext}</div><div><div class="name">{esc(name)}</div><div class="meta">{esc(meta)}</div></div></div>')
    # a forgetting curve: an illustration, no data, so no numbers on the axis
    curve = "M0 30 C 90 210, 200 330, 330 380 S 620 430, 760 438"
    inner.append('<div id="hchart" class="card" style="left:900px;top:190px;width:860px;height:520px">'
                 '<div class="h-kicker" style="position:absolute;left:40px;top:30px">What you remember</div>'
                 '<div class="axis" style="left:50px;top:90px;width:2px;height:350px"></div><div class="axis" style="left:50px;top:440px;width:770px;height:2px"></div>'
                 '<div id="hcurve" style="position:absolute;left:52px;top:62px;height:400px;width:0;overflow:hidden">'
                 f'<svg width="770" height="400" style="position:absolute;left:0;top:0"><path d="{curve}" fill="none" stroke="#2c2c2b" stroke-width="4" stroke-linecap="round"/></svg></div>'
                 '<div id="hl0" style="position:absolute;left:52px;top:460px;font-size:21px;color:var(--muted)">the night before</div>'
                 '<div id="hl1" style="position:absolute;right:40px;top:460px;font-size:21px;color:var(--muted)">a week later</div></div>')
    inner.append('<div id="hq" style="position:absolute;left:0;right:0;top:752px;text-align:center">'
                 '<div class="serif" style="font-size:54px;font-weight:500;letter-spacing:-.01em">Being tested does more for memory than reading again.</div>'
                 '<div style="margin-top:16px;font-size:21px;color:var(--subtle)">Adesope et al., 2017 · Agarwal et al., 2021 — cited in docs/PEDAGOGICAL_SPEC.md</div></div>')
    c.clip(0, s["end"] + XF, "".join(inner), "scene", fade=False)
    for i in range(3):
        c.show(f"#hf{i}", 0.5 + i * 0.75, 0.6, y=-40)
    c.show("#hchart", cue(2) - 0.2, 0.5)
    c.grow("#hcurve", cue(2) + 0.4, 3.4, 770)
    c.show("#hl0", cue(2) + 0.4, 0.4, 0)
    c.show("#hl1", cue(2) + 3.0, 0.4, 0)
    c.hide("#hf0,#hf1,#hf2,#hchart", cue(3) - 0.1, 0.5, 0.35)
    c.show("#hq", cue(3), 0.6)


def title(c: Comp) -> None:
    t0 = SCENES["what"]["start"]
    inner = ('<div style="position:absolute;left:0;right:0;top:330px;text-align:center">'
             f'<div id="tl0" style="display:inline-flex;align-items:center;gap:34px"><div style="width:132px;height:132px">{LOGO}</div>'
             '<div class="serif" style="font-size:140px;font-weight:650;letter-spacing:-.025em;line-height:1">MDlearn</div></div>'
             '<div id="tl1" style="margin-top:44px;font-size:38px;color:var(--muted)">Your class files, or just a topic, into better notes you can study.</div></div>')
    c.clip(t0, cue(5) - t0 + XF, inner, "scene")
    c.show("#tl0", t0 + 0.2, 0.7, 24)
    c.show("#tl1", t0 + 1.1, 0.7, 16)


def frame_scene(c: Comp, start: float, end: float, chips: list[tuple[float, str, str]], r: dict = WIN) -> None:
    """The paper background, the window and the step label for a stretch of UI pieces."""
    inner = [f'<div class="ui frame" style="left:{r["x"]}px;top:{r["y"]}px;width:{r["w"]}px;height:{r["h"]}px"></div>',
             f'<div class="brand" style="right:{W - r["x"] - r["w"]}px;top:{r["y"] - 46}px">{LOGO}<span>MDlearn Studio</span></div>']
    c.clip(start, end - start + XF, "".join(inner), "", fade=True)
    for i, (t, num, label) in enumerate(chips):
        t_end = chips[i + 1][0] if i + 1 < len(chips) else end
        body = f'<div class="chip" style="left:{r["x"]}px;top:{r["y"] - 48}px">{f"<b>{num}</b>" if num else ""}<span>{esc(label)}</span></div>'
        cid = c.clip(t, t_end - t + (XF if i + 1 == len(chips) else 0), body, "", fade=True, style="height:1px;background:transparent")
        c.js.append(f"tl.set('#{cid}', {{zIndex:900}}, {t:.3f});")


def pieces(c: Comp, cut: list[dict], names: list[str], r: dict = WIN) -> None:
    by = {p["name"]: p for p in cut}
    for i, n in enumerate(names):
        p = by[n]
        c.video(p["start"], p["dur"], f"{n}.mp4", fade=i > 0, r=r)


def home_callouts(c: Comp) -> None:
    rows = [(cue(5), "An AI you already use", "writes the notes"), (cue(5) + 2.2, "A strict compiler", "checks every one"),
            (cue(6), "Spaced repetition", "brings each idea back")]
    inner = ['<div id="hc" style="position:absolute;left:1430px;top:250px;width:430px">']
    for i, (_, a, b) in enumerate(rows):
        inner.append(f'<div id="hcr{i}" style="display:flex;gap:22px;align-items:flex-start;margin-bottom:54px">'
                     f'<b style="display:inline-grid;place-items:center;flex:none;width:42px;height:42px;border-radius:50%;background:var(--ink);color:#fff;font-size:21px">{i + 1}</b>'
                     f'<div><div style="font-size:31px;font-weight:600;line-height:1.25">{a}</div><div class="serif" style="font-size:29px;color:var(--muted);margin-top:4px">{b}</div></div></div>')
    inner.append("</div>")
    cid = c.clip(cue(5) - 0.1, cue(7) - cue(5) + 0.1, "".join(inner), "", fade=False, style="background:transparent")
    c.js.append(f"tl.set('#{cid}', {{zIndex:800}}, {cue(5) - 0.1:.3f});")
    c.show("#hc", cue(5), 0.45)
    for i, (t, _, _) in enumerate(rows):
        c.show(f"#hcr{i}", t + 0.1, 0.45, 14)


def source_callout(c: Comp) -> None:
    inner = ('<div id="sc" style="position:absolute;left:1430px;top:250px;width:440px">'
             '<div class="mono" style="font-size:24px;padding:12px 16px;border-radius:10px;background:#fff;border:1px solid var(--hair);display:inline-block">02-the-carnot-limit.md</div>'
             + "".join(f'<div style="font-size:31px;font-weight:600;margin-top:{48 if i == 0 else 30}px">{t}</div>' for i, t in enumerate(["Plain Markdown", "On your computer", "No account"]))
             + '<div class="serif" style="font-size:27px;color:var(--muted);margin-top:30px">Open it in any editor.</div></div>')
    t = cue(7) + 0.6
    cid = c.clip(t, SCENES["make"]["start"] - t, inner, "", fade=False, style="background:transparent")
    c.js.append(f"tl.set('#{cid}', {{zIndex:800}}, {t:.3f});")
    c.show("#sc", t, 0.45, 12)


def engine(c: Comp) -> None:
    s = SCENES["engine"]
    t0 = s["start"]
    md = [("k", "---"), ("", "title: The Carnot limit"), ("", "study: true"), ("k", "---"), ("", "## No engine beats a reversible one"), ("", ""),
          ("d", ":::quiz"), ("", "Two engines share the same reservoirs."), ("", "One is reversible. And the other?"),
          ("", "- [ ] It can be more efficient."), ("", "- [x] It is at most as efficient."), ("d", ":::"), ("", ""),
          ("d", ":::plot[The Carnot efficiency]"), ("", "$$\\eta = 1 - T_c / T$$"), ("", "- $T$ in [400, 1500] — hot side (K)"), ("d", ":::")]
    lines = "".join(f'<div class="{k}">{esc(t) or "&nbsp;"}</div>' for k, t in md)
    marks = "".join(f'<div class="mark em{i}" style="top:{33 * row - 1}px;height:33px"></div>' for i, row in enumerate([6, 13]))
    term = [("p", "$ mdlearn lint ."), ("e", "02-the-carnot-limit.md:21:1 E202 quiz-no-correct"),
            ("", "3 lessons checked · 1 error · 0 warnings · 3 notes hidden (--verbose)"), ("", ""), ("p", "$ mdlearn lint ."),
            ("ok", "3 lessons checked · 0 errors · 0 warnings · 3 notes hidden (--verbose)")]
    tlines = "".join(f'<div id="tm{i}" class="{k}">{esc(t) or "&nbsp;"}</div>' for i, (k, t) in enumerate(term))
    nodes = f"""
<div style="position:absolute;left:120px;top:76px"><div class="serif" style="font-size:58px;font-weight:600;letter-spacing:-.015em">Under the hood</div>
<div style="font-size:25px;color:var(--muted);margin-top:6px">One compiler, every way in.</div></div>
<div id="emd" class="card code" style="left:120px;top:250px;width:760px;height:690px;padding:36px 40px;box-sizing:border-box;overflow:hidden">
  <div class="k" style="font-family:var(--sans);font-size:20px;margin-bottom:14px">02-the-carnot-limit.md</div>
  <div style="position:relative">{marks}<div style="position:relative">{lines}</div></div></div>
<div id="eterm" class="card code term" style="left:120px;top:250px;width:760px;height:690px;padding:40px;box-sizing:border-box;font-size:21px;opacity:0">
  <div style="font-family:var(--sans);font-size:20px;color:#a09f9b;margin-bottom:20px">terminal</div>{tlines}
  <div id="elock" style="margin-top:44px;padding:24px 28px;border-radius:12px;background:#fff;color:var(--ink);font-family:var(--sans);font-size:23px;opacity:0">
   <div style="font-weight:600">In the app, a question with that error is locked.</div>
   <div style="color:var(--muted);margin-top:6px;font-size:21px">It never shows its answers, and the rest of the note still works.</div></div></div>
<div id="n1" class="card node" style="top:250px"><div class="t">Markdown notes</div><div class="s mono">01-energy-in-work-out.md · 02-the-carnot-limit.md …</div></div>
<div id="a1" class="arrow" style="top:378px"></div>
<div id="n2" class="card node" style="top:420px"><div class="t">The compiler <span class="mono" style="font-size:22px;color:var(--muted);font-weight:400">@mdlearn/core</span></div>
  <div style="margin-top:16px"><span id="p1" class="pill">parse</span><span id="p2" class="pill">validate</span><span id="p3" class="pill">lint</span></div></div>
<div id="a2" class="arrow" style="top:590px"></div>
<div id="n3" style="position:absolute;left:980px;top:632px;width:820px;display:flex;gap:20px">
  <div id="o1" class="card" style="position:relative;flex:1;padding:20px 24px"><div style="font-size:27px;font-weight:600">Studio</div><div style="font-size:20px;color:var(--muted)">desktop and browser</div></div>
  <div id="o2" class="card" style="position:relative;flex:1;padding:20px 24px"><div style="font-size:27px;font-weight:600">CLI</div><div class="mono" style="font-size:19px;color:var(--muted)">mdlearn review</div></div>
  <div id="o3" class="card" style="position:relative;flex:1;padding:20px 24px"><div style="font-size:27px;font-weight:600">MCP server</div><div style="font-size:20px;color:var(--muted)">for AI assistants</div></div></div>
<div id="a3" class="arrow" style="top:752px"></div>
<div id="n4" class="card node" style="top:794px;display:flex;justify-content:space-between;align-items:center">
  <div><div class="t">FSRS scheduler</div><div class="s">each card comes back just before you'd forget it</div></div>
  <div id="n5" class="mono" style="font-size:21px;padding:10px 16px;border-radius:8px;background:var(--paper);border:1px solid var(--hair)">progress.json</div></div>
"""
    c.clip(t0, s["end"] - t0 + XF, nodes, "scene")
    c.show("#n1", t0 + 0.4, 0.5)
    c.show(".em0", cue(13) + 2.4, 0.4, 0)
    c.show(".em1", cue(13) + 3.4, 0.4, 0)
    c.show("#a1", cue(14) - 0.2, 0.3, 0)
    c.show("#n2", cue(14), 0.5)
    c.hide("#emd", cue(14) + 0.2, 0.4)
    c.show("#eterm", cue(14) + 0.2, 0.4, 0)
    for i, d in enumerate([0.7, 1.4, 1.8, 3.6, 4.2, 4.9]):
        if i != 3:
            c.show(f"#tm{i}", cue(14) + d, 0.15, 0)
    for i, d in enumerate([1.0, 2.0, 3.0]):
        c.cls_on(f"#p{i + 1}", cue(14) + d)
    c.show("#elock", cue(14) + 5.4, 0.45, 10)
    c.show("#a2", cue(15) - 0.2, 0.3, 0)
    for i, d in enumerate([0.3, 1.9, 3.6]):
        c.show(f"#o{i + 1}", cue(15) + d, 0.45)
    c.show("#a3", cue(16) - 0.2, 0.3, 0)
    c.show("#n4", cue(16), 0.5)
    c.show("#n5", cue(16) + 2.4, 0.45, 8)
    # the clip starts hidden on these, until their moment
    c.js.insert(0, "gsap.set('#n1,#a1,#n2,#a2,#o1,#o2,#o3,#a3,#n4,#n5,.mark,#elock,#tm0,#tm1,#tm2,#tm4,#tm5', {opacity:0});")


def pixel_callout(c: Comp, cut: list[dict]) -> None:
    """A ring on Pixel, the companion's sprite in the sidebar, while its dialog opens (the close-up y4a)."""
    by = {p["name"]: p for p in cut}
    t0, t1 = by["y4a"]["start"] + 0.4, by["y4b"]["start"]
    x, y = 240, 846   # the sprite, in the y4a close-up inside the window
    inner = (f'<div id="px" style="position:absolute;left:{x - 38}px;top:{y - 38}px;width:76px;height:76px;border-radius:50%;'
             'border:3px solid var(--amber);box-shadow:0 0 0 6px rgb(214 170 40 / .18)"></div>'
             f'<div id="pxl" style="position:absolute;left:{x - 34}px;top:{y - 124}px;padding:12px 18px;border-radius:12px;background:var(--ink);color:#fff;'
             'font-size:24px;font-weight:600;white-space:nowrap">Pixel <span style="font-weight:400;color:#cfcdc7">· grows as you study</span></div>')
    cid = c.clip(t0, t1 - t0, inner, "", fade=False, style="background:transparent")
    c.js.append(f"tl.set('#{cid}', {{zIndex:850}}, {t0:.3f});")
    c.show("#px", t0, 0.35, 0)
    c.show("#pxl", t0 + 0.15, 0.4, 10)


def end_card(c: Comp) -> None:
    t0 = SCENES["start"]["start"]
    inner = (f'<div style="position:absolute;left:0;right:0;top:250px;text-align:center">'
             f'<div style="display:inline-flex;align-items:center;gap:26px"><div style="width:92px;height:92px">{LOGO}</div>'
             '<div class="serif" style="font-size:96px;font-weight:650;letter-spacing:-.02em;line-height:1">MDlearn</div></div>'
             '<div id="e1" style="margin-top:60px"><span class="mono" style="display:inline-block;font-size:40px;padding:20px 36px;border-radius:14px;background:#262624;color:#e7e6e2">'
             '<span style="color:#9cc59a">$</span> npx mdlearn studio</span></div>'
             '<div id="e2" style="margin-top:26px;font-size:28px;color:var(--muted)">or download the desktop app for Windows, macOS and Linux</div>'
             '<div id="e3" style="margin-top:64px;font-size:32px">Open source · MIT licence</div>'
             '<div id="e4" style="margin-top:18px;font-size:44px;font-weight:600">github.com/MD-Learn/MD-Learn</div>'
             '<div id="e5" style="margin-top:12px;font-size:26px;color:var(--muted)">Issues and pull requests are welcome.</div></div>')
    c.clip(t0, END - t0, inner, "scene")
    c.show("#e1", t0 + 0.5, 0.5)
    c.show("#e2", cue(25) + 2.4, 0.5)
    c.show("#e3", cue(26), 0.5)
    c.show("#e4", cue(26) + 2.9, 0.5)
    c.show("#e5", cue(26) + 4.2, 0.5)
    c.js.insert(0, "gsap.set('#e1,#e2,#e3,#e4,#e5', {opacity:0});")


def compose(cut: list[dict]) -> None:
    c = Comp()
    hook(c)
    title(c)
    frame_scene(c, cue(5), SCENES["make"]["start"], [(cue(5), "", "The first page"), (cue(7), "", "A note, as its Markdown source")], SPLIT)
    pieces(c, cut, ["home", "source"], SPLIT)
    home_callouts(c)
    source_callout(c)
    frame_scene(c, SCENES["make"]["start"], SCENES["engine"]["start"], [(SCENES["make"]["start"], "1", "Make a course")])
    pieces(c, cut, ["m1", "m2", "m3", "m4a", "m4b", "m5"])
    engine(c)
    frame_scene(c, SCENES["features"]["start"], SCENES["yours"]["start"], [(cue(17), "2", "Read"), (cue(19), "3", "Study"), (cue(20), "4", "Today")])
    pieces(c, cut, ["f1", "f2", "f3", "f4", "f5"])
    by = {p["name"]: p["start"] for p in cut}
    frame_scene(c, SCENES["yours"]["start"], SCENES["start"]["start"], [(cue(21), "5", "Make it yours"), (by["y3a"], "", "Explain, by a local AI model"),
                                                                       (by["y4a"], "", "Pixel, your study companion")])
    pieces(c, cut, ["y1", "y2", "y3a", "y3b", "y4a", "y4b"])
    pixel_callout(c, cut)
    end_card(c)
    audio = f'<audio id="voice" data-start="0" data-duration="{END:.3f}" data-volume="1" src="media/voiceover.wav"></audio>'
    html = f"""<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>MDlearn walkthrough</title><style>{CSS}</style></head><body>
<div id="root" data-composition-id="root" data-start="0" data-width="{W}" data-height="{H}" data-duration="{END:.3f}" data-fps="30">
{chr(10).join(c.parts)}
{audio}
</div>
<script src="media/gsap.min.js"></script>
<script>
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(c.js)}
tl.set({{}}, {{}}, {END:.3f});
window.__timelines = window.__timelines || {{}};
window.__timelines.root = tl;
</script>
</body></html>
"""
    (PROJ / "index.html").write_text(html)
    print(f"index.html: {len(c.parts)} clips, {len(c.js)} timeline entries, {END:.2f} s")


def main() -> None:
    MEDIA.mkdir(parents=True, exist_ok=True)
    fonts = REPO / "node_modules/@fontsource-variable/source-serif-4/files"
    shutil.copy(fonts / "source-serif-4-latin-wght-normal.woff2", MEDIA / "serif.woff2")
    shutil.copy(fonts / "source-serif-4-latin-wght-italic.woff2", MEDIA / "serif-italic.woff2")
    shutil.copy(HERE / "compose/node_modules/gsap/dist/gsap.min.js", MEDIA / "gsap.min.js")
    for w, f in [("400", "Regular"), ("500", "Medium"), ("600", "SemiBold")]:
        shutil.copy(f"/usr/share/fonts/noto/NotoSans-{f}.ttf", MEDIA / f"sans-{w}.ttf")
    shutil.copy("/usr/share/fonts/TTF/JetBrainsMonoNerdFont-Regular.ttf", MEDIA / "mono-400.ttf")
    voiceover()
    cut = cut_pieces()
    (HERE / "pieces.json").write_text(json.dumps(cut, indent=2))
    compose(cut)


if __name__ == "__main__":
    main()
