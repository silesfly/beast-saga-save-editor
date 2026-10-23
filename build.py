"""Build with local WebView2 SDK files; no downloads or game/save reads."""
from pathlib import Path
import argparse
import os
import subprocess

ROOT = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--webview2', type=Path, required=True,
                    help='Directory containing Core.dll, WinForms.dll, x64 loader and LICENSE.txt')
args = parser.parse_args()
sdk = args.webview2.resolve()
src, out = ROOT / 'src', ROOT / 'dist'
out.mkdir(exist_ok=True)
version = '0.9'
html = (src / 'equipment-page.html').read_text(encoding='utf-8')
modules = [('CORE', 'item-core'), ('CATALOG', 'catalog'), ('EQUIPMENT', 'equipment'),
           ('STATCATALOG', 'stat-catalog'), ('STATS', 'stats'), ('FRIENDS', 'friends'),
           ('POINTS', 'points'), ('CATEGORIES', 'categories'), ('LIST', 'inventory-list'), ('UI', 'equipment-ui')]
for marker, name in modules:
    html = html.replace('/* ' + marker + ' */', (src / (name + '.js')).read_text(encoding='utf-8'))
html_path = out / f'BeastSagaEquipmentEditor-v{version}.html'
html_path.write_text(html, encoding='utf-8')
names = ['Microsoft.Web.WebView2.Core.dll', 'Microsoft.Web.WebView2.WinForms.dll', 'WebView2Loader.dll', 'LICENSE.txt']
for name in names:
    if not (sdk / name).is_file():
        parser.error('Missing WebView2 SDK file: ' + name)
compiler = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Microsoft.NET/Framework64/v4.0.30319/csc.exe'
exe = out / f'BeastSagaEquipmentEditor-v{version}.exe'
command = [str(compiler), '/nologo', '/target:winexe', '/platform:x64', '/optimize+', '/debug-', '/out:' + str(exe)]
command += ['/reference:' + name for name in ['System.Windows.Forms.dll', 'System.Drawing.dll', 'System.Web.Extensions.dll']]
command += ['/reference:' + str(sdk / name) for name in names[:2]]
command += ['/resource:' + str(sdk / name) + ',' + name for name in names[:3]]
command += ['/resource:' + str(sdk / 'LICENSE.txt') + ',WebView2-LICENSE.txt',
            '/resource:' + str(html_path) + ',editor.html', str(src / 'EquipmentEditor.cs'), str(src / 'SaveStore.cs')]
subprocess.run(command, cwd=ROOT, check=True)
print('Built', exe.name, 'and', html_path.name)
