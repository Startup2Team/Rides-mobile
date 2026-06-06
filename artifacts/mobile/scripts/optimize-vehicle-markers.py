#!/usr/bin/env python3
"""Resize large vehicle PNGs in assets/images/ to ~256px-wide markers in vehicle-markers/."""
from __future__ import annotations

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
IMAGES = ROOT / "assets" / "images"
MARKERS = ROOT / "assets" / "vehicle-markers"
TARGET_WIDTH = 256

# Same side-view sources as cab / hilux / fuso — one optimized file for chips and map.
VEHICLE_NAMES = ("cab", "hilux", "fuso", "rifani")


def resize_to_marker_width(src: Path, dst: Path) -> None:
    image = Image.open(src).convert("RGBA")
    width, height = image.size
    if width != TARGET_WIDTH:
        new_h = max(1, round(height * TARGET_WIDTH / width))
        image = image.resize((TARGET_WIDTH, new_h), Image.Resampling.LANCZOS)
    dst.parent.mkdir(parents=True, exist_ok=True)
    image.save(dst, optimize=True)


def main() -> None:
    for name in VEHICLE_NAMES:
        src = IMAGES / f"{name}.png"
        if not src.is_file():
            print(f"skip {name}: missing {src}")
            continue
        dst = MARKERS / f"{name}.png"
        resize_to_marker_width(src, dst)
        with Image.open(dst) as out:
            size = out.size
        kb = dst.stat().st_size // 1024
        print(f"{name}.png -> {size[0]}x{size[1]} ({kb} KB)")


if __name__ == "__main__":
    main()
