Paste transparent PNG vehicle marker images in this folder.

Use these exact filenames so the app can reference them cleanly:

- moto.png, cab.png, hilux.png, fuso.png, rifani.png (chips / selectors)
- moto-map.png (live map marker for moto only)
- cab.png, hilux.png, fuso.png, rifani.png (chips and live map — same files)

Regenerate optimized markers from large sources in `assets/images/`:

```bash
python artifacts/mobile/scripts/optimize-vehicle-markers.py
```

Best format:

- PNG with transparent background
- Vehicle already cropped tightly
- Side-view image like the examples
- Around 256px wide is enough
- No text, watermark, or white background
- If the source PNG already has transparency (e.g. moto5), trim and resize only — do not run black background removal (it eats dark bike pixels)
