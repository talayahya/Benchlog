"""Render a caption-led Benchlog walkthrough from real, supplied app captures.

No browser automation, invented cursor, generated UI, narration or image sequence.
Frames are streamed to ffmpeg. The manifest makes every capture/crop/audio cue
explicit. See docs/video/demo-manifest.json. Run --check before rendering.
Pillow and imageio_ffmpeg may be installed normally or in CV/tmp/benchlog_video_tools.
"""
from __future__ import annotations

import argparse
import json
import math
import shutil
import subprocess
import sys
from functools import lru_cache
from pathlib import Path

REPO = Path(__file__).resolve().parents[1]
TOOLS = REPO.parent / "tmp" / "benchlog_video_tools"
if TOOLS.is_dir():
    sys.path.insert(0, str(TOOLS))

from PIL import Image, ImageDraw, ImageFont  # noqa: E402
import imageio_ffmpeg  # noqa: E402

WIDTH, HEIGHT = 1280, 720
INK = "#172B32"
MUTED = "#51646A"
PAGE = "#F8FAF8"
BORDER = "#D3DDDA"
ACCENT = "#B73F27"
FRAME = (24, 60, 1256, 584)
DEFAULT_OUTPUT = REPO.parent / "output" / "Tala_Yahya_Benchlog_Demo.mp4"


def path_from(value: str, base: Path) -> Path:
    path = Path(value)
    return (path if path.is_absolute() else base / path).resolve()


@lru_cache(maxsize=20)
def font(size: int, bold: bool = False, mono: bool = False):
    name = "consola.ttf" if mono else "segoeuib.ttf" if bold else "segoeui.ttf"
    source = Path("C:/Windows/Fonts") / name
    if not source.is_file():
        raise FileNotFoundError(f"Required font missing: {source}")
    return ImageFont.truetype(str(source), size)


def wrap(draw: ImageDraw.ImageDraw, value: str, face, max_width: int) -> list[str]:
    lines: list[str] = []
    for paragraph in value.split("\n"):
        current = ""
        for word in paragraph.split():
            proposed = f"{current} {word}".strip()
            if current and draw.textlength(proposed, font=face) > max_width:
                lines.append(current)
                current = word
            else:
                current = proposed
        lines.append(current)
    return lines


def crop_box(box, image: Image.Image) -> tuple[int, int, int, int]:
    if box is None:
        return 0, 0, image.width, image.height
    if len(box) != 4 or not all(isinstance(x, (int, float)) for x in box):
        raise ValueError("crop must be [left, top, right, bottom] in source pixels")
    left, top, right, bottom = map(int, box)
    if not (0 <= left < right <= image.width and 0 <= top < bottom <= image.height):
        raise ValueError(f"Crop {box} is outside image {image.size}")
    return left, top, right, bottom


def load_manifest(path: Path):
    spec = json.loads(path.read_text(encoding="utf-8-sig"))
    base = path_from(spec.get("base_dir", "."), path.parent)
    if spec.get("version") != 1:
        raise ValueError("Manifest version must be 1")
    if not spec.get("scenes"):
        raise ValueError("Manifest needs at least one scene")
    shots = []
    start = 0.0
    for index, scene in enumerate(spec["scenes"]):
        scene_length = float(scene["duration"])
        if not math.isfinite(scene_length) or scene_length <= 0:
            raise ValueError("Scene duration must be finite and positive")
        scene_shots = scene.get("shots", [])
        if not scene_shots:
            raise ValueError(f"Scene {index + 1} needs a real capture")
        durations = [float(s["duration"]) for s in scene_shots]
        if any(not math.isfinite(d) or d <= 0 for d in durations):
            raise ValueError("Shot durations must be finite and positive")
        if abs(sum(durations) - scene_length) > 0.001:
            raise ValueError(f"Scene {index + 1}: shot durations do not sum to scene duration")
        for shot, length in zip(scene_shots, durations):
            image_path = path_from(shot["image"], base)
            if not image_path.is_file():
                raise FileNotFoundError(f"Capture not supplied: {image_path}")
            with Image.open(image_path) as source:
                image = source.convert("RGB")
            box = crop_box(shot.get("crop"), image)
            end_box = crop_box(shot["end_crop"], image) if "end_crop" in shot else None
            motion = float(shot.get("motion_seconds", 1.5)) if end_box else 0
            if motion < 0 or motion > length * 0.2:
                raise ValueError("Any crop movement must occupy at most 20% of the shot")
            caption = str(shot.get("caption", ""))
            detail = str(shot.get("detail", ""))
            if not caption:
                raise ValueError("Each shot needs an understandable caption")
            shots.append({
                **shot, "start": start, "duration": length, "source": image,
                "box": box, "end_box": end_box, "motion": motion,
                "caption": caption, "detail": detail,
                "title": str(scene["title"]), "scene_number": index + 1,
                "scene_count": len(spec["scenes"]), "path": str(image_path),
            })
            start += length
    expected = spec.get("expected_duration")
    if expected is not None and abs(start - float(expected)) > 0.001:
        raise ValueError(f"Expected {expected} seconds but scenes sum to {start}")
    for cue in spec.get("audio", []):
        cue["path"] = str(path_from(cue["file"], base))
        if not Path(cue["path"]).is_file():
            raise FileNotFoundError(f"Audio clip not supplied: {cue['path']}")
        if float(cue["start"]) < 0 or float(cue["start"]) >= start:
            raise ValueError("Audio cue starts outside the video")
        if cue.get("kind") != "synthetic-input":
            raise ValueError("Only explicitly labelled synthetic-input audio is supported")
    return spec, shots, start


def render_frame(shot: dict, local_time: float, disclosure: str) -> Image.Image:
    canvas = Image.new("RGB", (WIDTH, HEIGHT), PAGE)
    draw = ImageDraw.Draw(canvas)
    draw.text((24, 15), "Benchlog", font=font(23, True), fill=INK)
    draw.text((156, 19), shot["title"], font=font(18), fill=MUTED)
    count = f"{shot['scene_number']:02d} / {shot['scene_count']:02d}"
    draw.text((1180, 20), count, font=font(15, mono=True), fill=MUTED)

    box = shot["box"]
    if shot["end_box"] is not None:
        # One gentle crop move, then a still frame for at least 80% of this shot.
        progress = min(1.0, local_time / max(0.001, shot["motion"]))
        progress = progress * progress * (3 - 2 * progress)
        box = tuple(round(a + (b - a) * progress) for a, b in zip(box, shot["end_box"]))
    source = shot["source"].crop(box)
    available_width, available_height = FRAME[2] - FRAME[0], FRAME[3] - FRAME[1]
    scale = min(available_width / source.width, available_height / source.height)
    # Never upscale by more than 1.5x. Use a closer actual capture if text needs more.
    scale = min(scale, 1.5)
    size = (max(1, round(source.width * scale)), max(1, round(source.height * scale)))
    source = source.resize(size, Image.Resampling.LANCZOS)
    x = FRAME[0] + (available_width - source.width) // 2
    y = FRAME[1] + (available_height - source.height) // 2
    draw.rectangle(FRAME, fill="white", outline=BORDER, width=1)
    canvas.paste(source, (x, y))

    caption_lines = wrap(draw, shot["caption"], font(25, True), WIDTH - 64)
    if len(caption_lines) > 2:
        raise ValueError(f"Caption too long for two readable lines: {shot['caption']}")
    for line_index, line in enumerate(caption_lines):
        draw.text((32, 602 + line_index * 31), line, font=font(25, True), fill=INK)
    detail_y = 602 + len(caption_lines) * 31 + 3
    if shot["detail"]:
        detail_lines = wrap(draw, shot["detail"], font(17), WIDTH - 64)
        if len(detail_lines) > 1 or detail_y + 23 > 687:
            raise ValueError(f"Detail too long for its readable line: {shot['detail']}")
        draw.text((32, detail_y), detail_lines[0], font=font(17), fill=MUTED)
    draw.line((24, 689, WIDTH - 24, 689), fill=BORDER, width=1)
    draw.text((24, 695), disclosure, font=font(12), fill=MUTED)
    return canvas


def make_audio(spec: dict, duration: float, destination: Path) -> Path | None:
    cues = spec.get("audio", [])
    if not cues:
        return None
    command = [imageio_ffmpeg.get_ffmpeg_exe(), "-hide_banner", "-loglevel", "error", "-y"]
    for cue in cues:
        command += ["-i", cue["path"]]
    filters, names = [], []
    for index, cue in enumerate(cues):
        offset_ms = round(float(cue["start"]) * 1000)
        gain = float(cue.get("gain", 0.85))
        if not 0 < gain <= 1:
            raise ValueError("Audio gain must be between zero and one")
        name = f"clip{index}"
        filters.append(
            f"[{index}:a]aresample=16000,aformat=channel_layouts=mono,"
            f"volume={gain},adelay={offset_ms},apad=whole_dur={duration}[{name}]"
        )
        names.append(f"[{name}]")
    filters.append("".join(names) + f"amix=inputs={len(cues)}:normalize=0:duration=longest[out]")
    command += ["-filter_complex", ";".join(filters), "-map", "[out]", "-t", str(duration),
                "-ar", "16000", "-ac", "1", "-c:a", "pcm_s16le", str(destination)]
    subprocess.run(command, check=True, capture_output=True, text=True)
    return destination


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--manifest", type=Path, default=REPO / "docs/video/demo-manifest.json")
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--fps", type=int, default=24)
    parser.add_argument("--check", action="store_true", help="Validate all assets and caption lengths only")
    parser.add_argument("--preview-dir", type=Path, help="Save one JPEG per shot for visual review")
    parser.add_argument("--preview-only", action="store_true")
    parser.add_argument("--keep-audio", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.fps <= 30:
        parser.error("fps must be between 1 and 30")
    spec, shots, duration = load_manifest(args.manifest.resolve())
    disclosure = spec.get("disclosure", "Edited app capture sequence · synthetic speech and readings")
    previews = []
    for shot in shots:
        previews.append(render_frame(shot, shot["duration"] / 2, disclosure))
    print(f"Validated {len(shots)} shots, {duration:.1f}s, {len(spec.get('audio', []))} labelled audio clips.", flush=True)
    if args.preview_dir:
        args.preview_dir.mkdir(parents=True, exist_ok=True)
        for i, frame in enumerate(previews, 1):
            frame.save(args.preview_dir / f"shot-{i:02d}.jpg", quality=90)
    if args.check or args.preview_only:
        return
    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    free_mb = shutil.disk_usage(output.parent).free / 1024**2
    if free_mb < 80:
        raise RuntimeError(f"Only {free_mb:.0f} MB free; allow at least 80 MB before encoding")
    audio_file = output.with_suffix(".speech-work.wav")
    audio_path = None
    writer = None
    frames_written = 0
    try:
        audio_path = make_audio(spec, duration, audio_file)
        writer = imageio_ffmpeg.write_frames(
            output, (WIDTH, HEIGHT), fps=args.fps, codec="libx264", quality=None,
            macro_block_size=16, audio_path=str(audio_path) if audio_path else None,
            audio_codec="aac" if audio_path else None,
            output_params=["-crf", "22", "-preset", "medium", "-movflags", "+faststart",
                           "-t", str(duration), "-metadata", "title=Benchlog: a test that tells them apart",
                           "-metadata", "comment=Edited real app captures; synthetic speech and readings; no physical trial"],
            ffmpeg_log_level="warning",
        )
        writer.send(None)
        for shot in shots:
            stop_frame = round((shot["start"] + shot["duration"]) * args.fps)
            static_bytes = None
            print(f"Scene {shot['scene_number']}: {shot['title']} [{Path(shot['path']).name}]", flush=True)
            while frames_written < stop_frame:
                local_time = frames_written / args.fps - shot["start"]
                moving = shot["end_box"] is not None and local_time < shot["motion"]
                if moving:
                    data = render_frame(shot, local_time, disclosure).tobytes()
                else:
                    if static_bytes is None:
                        static_bytes = render_frame(shot, local_time, disclosure).tobytes()
                    data = static_bytes
                writer.send(data)
                frames_written += 1
        writer.close()
        writer = None
    finally:
        if writer is not None:
            writer.close()
        if audio_path and audio_path.exists() and not args.keep_audio:
            audio_path.unlink()
    print(f"Rendered {frames_written} frames to {output} ({output.stat().st_size / 1024**2:.1f} MB).", flush=True)


if __name__ == "__main__":
    main()
