#!/usr/bin/env bash
# Network Toolkit — IPs, DNS flush, ping, speed check, listening ports
source "${CHINNA_LIB:-$HOME/.chinna/lib}/plugins/_common.sh"

gs_plugin_meta(){ echo '{"id":"network-toolkit","name":"Network Toolkit","icon":"🛰","description":"Public/local IP, DNS flush, ping, quick speed check and open ports.","category":"Network"}'; }

gs_plugin_actions(){ cat <<'JSON'
[
 {"id":"publicip","name":"Public IP","kind":"button"},
 {"id":"localip","name":"Local IP","kind":"button"},
 {"id":"flushdns","name":"Flush DNS","kind":"button","confirm":"Flush the macOS DNS cache? You may be asked for your password in Terminal."},
 {"id":"ports","name":"Listening Ports","kind":"button"},
 {"id":"speed","name":"Quick Speed Check","kind":"button"},
 {"id":"ping","name":"Ping Host","kind":"form","fields":[{"name":"host","label":"Host","placeholder":"github.com","type":"text","required":true}]}
]
JSON
}

gs_plugin_run_action(){
  case "$1" in
    publicip)
      local ip; ip="$(curl -fsS --max-time 8 https://api.ipify.org 2>/dev/null)"
      [ -n "$ip" ] && gs_ok "Public IP: $ip" || gs_fail "Could not reach IP service";;
    localip)
      local ip; ip="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null)"
      [ -n "$ip" ] && gs_ok "Local IP: $ip" || gs_fail "No active LAN/Wi-Fi interface";;
    flushdns)
      if dscacheutil -flushcache 2>/dev/null && killall -HUP mDNSResponder 2>/dev/null; then
        gs_ok "DNS cache flushed"
      else
        gs_fail "Flush needs admin rights. Run in Terminal: sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder"
      fi;;
    ports)
      local out; out="$(lsof -iTCP -sTCP:LISTEN -nP 2>/dev/null | awk 'NR==1||NR<=18{print $1, $2, $9}')"
      [ -n "$out" ] && gs_ok "$out" || gs_fail "No listening TCP ports found";;
    speed)
      local url="https://speed.cloudflare.com/__down?bytes=10000000"
      local res; res="$(curl -o /dev/null -fsS --max-time 25 -w '%{speed_download} %{time_total}' "$url" 2>/dev/null)"
      if [ -n "$res" ]; then
        local bps tt mbps; bps="$(echo "$res" | awk '{print $1}')"; tt="$(echo "$res" | awk '{print $2}')"
        mbps="$(awk -v b="$bps" 'BEGIN{printf "%.1f", (b*8)/1000000}')"
        gs_ok "Download ~${mbps} Mbps over ${tt}s (10 MB test)"
      else gs_fail "Speed test could not complete"; fi;;
    ping)
      local h; h="$(gs_payload_value host "")"
      [ -n "$h" ] || { gs_fail "Enter a host"; return 1; }
      local out; out="$(ping -c 4 -t 6 "$h" 2>&1 | tail -n 3)"
      [ -n "$out" ] && gs_ok "$out" || gs_fail "Ping failed for $h";;
    *) gs_fail "unknown action";;
  esac
}
