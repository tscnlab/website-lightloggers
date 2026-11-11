"""Render the isolated ENLIGHT Quarto project beside the light logger inventory."""
from pathlib import Path
import shutil
import subprocess

root = Path(__file__).resolve().parents[1]
source = root / "enlight"
site = root / "_site"

# The root project must finish before this step, since it owns the Pages output.
if not (site / "lightloggers" / "index.html").is_file():
    raise SystemExit("Render the root light logger project before building ENLIGHT.")
if not (source / "_quarto.yml").is_file():
    raise SystemExit("Missing enlight/_quarto.yml.")

# Override only the isolated project's output, independent of its preview setup.
subprocess.run(["quarto", "render", "--output-dir", "_site"], cwd=source, check=True)
rendered = source / "_site"
if not (rendered / "index.html").is_file():
    raise SystemExit("ENLIGHT render did not produce _site/index.html.")
target = site / "enlight"
if target.exists():
    shutil.rmtree(target)
shutil.copytree(rendered, target)
print("Built ENLIGHT wizard at /enlight/; retained /lightloggers/.")
