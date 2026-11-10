"""Add the resources landing page after Quarto renders /lightloggers/."""
from pathlib import Path
import shutil

root = Path(__file__).resolve().parents[1]
site = root / "_site"
assert (site / "lightloggers/index.html").is_file()
shutil.copy2(root / "assets/resources-home.html", site / "index.html")
shutil.copy2(root / "CNAME", site / "CNAME")
(site / ".nojekyll").touch()
print("Built resources landing page; light logger directory is at /lightloggers/.")
