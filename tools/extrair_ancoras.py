"""Gera data/boi_ancora.json e data/milho_ancora.json a partir dos anexos (rodar uma vez)."""
import re, json, sys, datetime as dt
import openpyxl
from PIL import Image
import numpy as np
xlsx, svg, jpg, out = sys.argv[1:5]

# ---- boi: serie ancora Brasil x Paraguai (US$/kg carcaca)
ws = openpyxl.load_workbook(xlsx, data_only=True).worksheets[0]
d, br, py = [], [], []
for r in ws.iter_rows(min_row=2, values_only=True):
    if isinstance(r[0], dt.datetime) and r[1] and r[2]:
        d.append(r[0].strftime("%Y-%m-%d")); br.append(round(float(r[1]), 4)); py.append(round(float(r[2]), 4))
json.dump({"fonte": "Correlación.xlsx (série âncora Paraguai × Brasil, US$/kg carcaça)", "d": d, "br": br, "py": py},
          open(out + "/boi_ancora.json", "w"), separators=(",", ":"))
print("boi", len(d), d[0], d[-1])

# ---- milho: Paraguai interno x CCM B3 spot (US$/t), vetorial do PDF StoneX (pag. 46)
s = open(svg).read()
series = []
for m in re.finditer(r'<path([^>]*?)d="([^"]{2000,})"', s):
    if 'stroke-width="5"' not in m.group(1): continue
    pts = []
    for c, nums in re.findall(r'([MLC])\s*([-\d\.\s]+)', m.group(2)):
        v = list(map(float, nums.split()))
        if c in "ML": pts.append((v[0], v[1]))
        else: pts += [(v[i + 4], v[i + 5]) for i in range(0, len(v), 6)]
    series.append(pts)
Y50, Y400 = 149.308594, 429.980469
val = lambda y: 50 + (y - Y50) / (Y400 - Y50) * 350
d0 = dt.date(2019, 11, 11)
md = [(d0 + dt.timedelta(days=7 * i)).isoformat() for i in range(len(series[0]))]
pyi = [round(val(y), 1) for _, y in series[0]]
b3 = [round(val(y), 1) for _, y in series[1]]
basis = [round(a - b, 1) for a, b in zip(pyi, b3)]
print("milho vetorial", len(md), md[0], md[-1], pyi[:3], b3[:3], basis[-3:])

# ---- cauda (fev-jul/2026): digitalizada do grafico de basis em imagem
im = np.asarray(Image.open(jpg).convert("RGB")).astype(int)
R, G, B = im[..., 0], im[..., 1], im[..., 2]
mask = (R < 70) & (G < 70) & (B > 60) & (B - R > 35)
ys_axis = {}
H, W = mask.shape
cols = {}
for x in range(140, W - 20):
    yy = np.where(mask[60:860, x])[0]
    if len(yy): cols[x] = 60 + yy.mean()
xs = sorted(cols)
x0, x1 = xs[0], xs[-1]
print("jpg linha de", x0, "a", x1)
# eixo y: gridlines cinza claros -> $0 em y=97, -120 em y=831 (medidos na imagem)
def grid_rows():
    g = (abs(R - G) < 8) & (abs(G - B) < 8) & (R > 200) & (R < 235)
    rows = [y for y in range(60, 860) if g[y, 300:1500].mean() > 0.8]
    out_ = []
    for y in rows:
        if not out_ or y - out_[-1][-1] > 3: out_.append([y])
        else: out_[-1].append(y)
    return [sum(a) / len(a) for a in out_]
gr = grid_rows(); print("gridlines", [round(g, 1) for g in gr])
ytop, ybot = gr[0], gr[-1]            # 0 e -120
bval = lambda y: -(y - ytop) / (ybot - ytop) * 120
# calibra o eixo x casando a serie da imagem com a vetorial (busca do fim da serie em semanas)
best = None
img = lambda x: bval(cols[min(cols, key=lambda k: abs(k - x))])
for nweeks in range(340, 356):
    step = (x1 - x0) / nweeks
    err = np.mean([abs(img(x0 + i * step) - basis[i]) for i in range(0, 325, 3)])
    if best is None or err < best[0]: best = (err, nweeks, step)
print("calibracao x: erro medio %.2f US$/t, semanas=%d, px/sem=%.3f" % best)
_, nweeks, step = best
cauda_d, cauda_b = [], []
for i in range(325, nweeks + 1):
    cauda_d.append((d0 + dt.timedelta(days=7 * i)).isoformat()); cauda_b.append(round(img(x0 + i * step), 1))
print("cauda", cauda_d[0], cauda_d[-1], cauda_b[-5:])
json.dump({"fonte": "StoneX (Carlos Sanabria, jul/2026): Paraguai interno × CCM B3 spot, US$/t, semanal. Até jan/2026 extraído do gráfico vetorial; cauda de basis digitalizada da imagem.",
           "d": md, "py": pyi, "b3": b3, "basis": basis, "cauda_d": cauda_d, "cauda_basis": cauda_b},
          open(out + "/milho_ancora.json", "w"), separators=(",", ":"))
