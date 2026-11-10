"""Package the Quarto sources, rendered site and verification artifacts."""
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

root = Path(__file__).resolve().parents[1]
target = root.parent / "lightloggers-quarto.zip"
excluded = {".venv", ".quarto", "__pycache__", ".git", ".DS_Store", "output"}
with ZipFile(target, "w", ZIP_DEFLATED) as archive:
    for path in sorted(root.rglob("*")):
        relative = path.relative_to(root)
        if path.is_file() and not excluded.intersection(relative.parts) and not path.name.endswith(".quarto_ipynb"):
            archive.write(path, Path("lightloggers") / relative)
with ZipFile(target) as archive:
    assert archive.testzip() is None
    assert "lightloggers/.github/workflows/pages.yml" in archive.namelist()
    assert "lightloggers/_site/index.html" in archive.namelist()
print(f"Packaged {target} ({target.stat().st_size:,} bytes)")
