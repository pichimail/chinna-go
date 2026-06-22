#!/usr/bin/env bash
mkdir -p ~/.chinna/dashboard
curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/dashboard/studio-layer.css -o ~/.chinna/dashboard/studio-layer.css
curl -fsSL https://raw.githubusercontent.com/pichimail/chinna-go/main/dashboard/runtime.txt -o ~/.chinna/dashboard/studio-layer.js
echo done
