"""Generate the deployable site, never including server edits or credentials."""
from pathlib import Path
import shutil
import sys
ROOT = Path(__file__).resolve().parents[1]
output = Path(sys.argv[1]).resolve() if len(sys.argv)>1 else ROOT / 'site'
if output.exists():
    raise SystemExit(f'Output exists: {output}. Use a fresh build directory.')
shutil.copytree(ROOT / 'web', output)
(output / 'data').mkdir()
shutil.copy2(ROOT / 'data/source.json', output / 'data/source.json')
(output / 'config.js').write_text('window.CALIBRATION_STATIC = true;\n')
(output / '.nojekyll').touch()
print(f'GitHub Pages site built at {output}')
