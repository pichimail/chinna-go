#!/usr/bin/env bash
mkdir -p ~/.chinna/dashboard
curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/dashboard/studio-layer.css -o ~/.chinna/dashboard/studio-layer.css
curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/dashboard/runtime.txt -o ~/.chinna/dashboard/studio-layer.js
python3 - ~/.chinna/dashboard/index.html <<'PY'
import pathlib, sys
p=pathlib.Path(sys.argv[1])
s=p.read_text()
s=s.replace('<link rel="stylesheet" href="studio-layer.css">','')
s=s.replace('<script src="studio-layer.js"></script>','')
s=s.replace('</head>','<link rel="stylesheet" href="studio-layer.css">\n</head>')
s=s.replace('</body>','<script src="studio-layer.js"></script>\n</body>')
p.write_text(s)
PY
echo done
