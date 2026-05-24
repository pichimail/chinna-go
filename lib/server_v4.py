#!/usr/bin/env python3
"""Chinna V4-Pro Dashboard Server"""
import http.server,json,subprocess,os,re,sys,threading,time,urllib.parse,base64,tempfile,urllib.request

PORT=int(sys.argv[1]) if len(sys.argv)>1 else 7777
HOME=os.path.expanduser('~')
CHINNA_HOME=os.environ.get('CHINNA_HOME',os.path.join(HOME,'.chinna'))
DASHBOARD_DIR=os.path.join(CHINNA_HOME,'dashboard')
API_KEYS_FILE=os.path.join(CHINNA_HOME,'api_keys.json')
CONFIG_FILE=os.path.join(CHINNA_HOME,'config')

stats_cache={}
cache_lock=threading.Lock()
SAFE_BLOCK=['rm -rf /','sudo rm -rf /','dd if=',':(){:|:&};:','mkfs']

FREE_MODELS=['meta-llama/llama-3.3-70b-instruct:free','deepseek/deepseek-r1:free','google/gemma-3-27b-it:free','mistralai/mistral-7b-instruct:free','microsoft/phi-4-reasoning:free']

def sh(cmd,timeout=15,default=''):
    try:
        r=subprocess.run(cmd,shell=True,capture_output=True,text=True,timeout=timeout)
        return (r.stdout or '').strip()
    except:return default

def sh2(cmd,timeout=20):
    try:
        r=subprocess.run(cmd,shell=True,capture_output=True,text=True,timeout=timeout)
        return r.stdout.strip(),r.stderr.strip(),r.returncode
    except Exception as e:return'',str(e),1

def load_keys():
    keys={}
    try:
        if os.path.exists(API_KEYS_FILE):
            with open(API_KEYS_FILE)as f:keys=json.load(f)
    except:pass
    if os.path.exists(CONFIG_FILE):
        with open(CONFIG_FILE)as f:
            for line in f:
                for k in['OPENROUTER_API_KEY','OPENAI_API_KEY','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID']:
                    if k in line:
                        m=re.search(r"['\"]([^'\"]{10,})['\"]",line)
                        if m and k not in keys:keys[k]=m.group(1)
    for k in['OPENROUTER_API_KEY','OPENAI_API_KEY','TELEGRAM_BOT_TOKEN','TELEGRAM_CHAT_ID']:
        if k not in keys and os.environ.get(k):keys[k]=os.environ[k]
    return keys

def save_keys(keys):
    os.makedirs(CHINNA_HOME,exist_ok=True)
    existing=load_keys()
    existing.update(keys)
    with open(API_KEYS_FILE,'w')as f:json.dump(existing,f)

def getkey(k):return load_keys().get(k,'')

def call_ai(prompt,model=None,free=True,file_b64=None,file_mime=None):
    key=getkey('OPENROUTER_API_KEY')
    if not key:return None,'no_key'
    models=[model] if model else(FREE_MODELS if free else['anthropic/claude-sonnet-4-5','openai/gpt-4o','google/gemini-pro-1.5'])
    msgs=[{'role':'user','content':prompt}]
    if file_b64 and file_mime and file_mime.startswith('image/'):
        msgs=[{'role':'user','content':[{'type':'image_url','image_url':{'url':f'data:{file_mime};base64,{file_b64}'}},{'type':'text','text':prompt}]}]
    for m in models:
        try:
            payload=json.dumps({'model':m,'max_tokens':1200,'messages':msgs}).encode()
            req=urllib.request.Request('https://openrouter.ai/api/v1/chat/completions',data=payload,
                headers={'Authorization':f'Bearer {key}','Content-Type':'application/json','HTTP-Referer':'https://chinna.app','X-Title':'Chinna V4'})
            with urllib.request.urlopen(req,timeout=30)as resp:
                d=json.loads(resp.read())
                return d['choices'][0]['message']['content'],m
        except:continue
    return None,'all_failed'

def call_openai(prompt,file_b64=None,file_mime=None):
    key=getkey('OPENAI_API_KEY')
    if not key:return None,'no_key'
    msgs=[{'role':'user','content':prompt}]
    if file_b64 and file_mime and file_mime.startswith('image/'):
        msgs=[{'role':'user','content':[{'type':'image_url','image_url':{'url':f'data:{file_mime};base64,{file_b64}'}},{'type':'text','text':prompt}]}]
    try:
        payload=json.dumps({'model':'gpt-4o-mini','max_tokens':1000,'messages':msgs}).encode()
        req=urllib.request.Request('https://api.openai.com/v1/chat/completions',data=payload,
            headers={'Authorization':f'Bearer {key}','Content-Type':'application/json'})
        with urllib.request.urlopen(req,timeout=30)as resp:
            d=json.loads(resp.read())
            return d['choices'][0]['message']['content'],'gpt-4o-mini'
    except Exception as e:return None,str(e)

def collect():
    s={}
    df=sh("df -h /System/Volumes/Data 2>/dev/null || df -h /")
    lines=[l for l in df.split('\n') if l and not l.startswith('File')]
    if lines:
        p=lines[0].split()
        try:s['disk']={'total':p[1],'used':p[2],'free':p[3],'pct':int(re.sub(r'%','',p[4]))}
        except:s['disk']={'total':'?','used':'?','free':'?','pct':0}
    vm=sh("vm_stat");ps=16384
    s['memory']={'free':0,'active':0,'inactive':0,'wired':0,'compressed':0}
    for line in vm.split('\n'):
        for k,mk in[('Pages free','free'),('Pages active','active'),('Pages inactive','inactive'),('Pages wired down','wired'),('Pages occupied by compressor','compressed')]:
            if k in line:
                try:s['memory'][mk]=int(re.findall(r'\d+',line.split(':')[1])[0])*ps//1048576
                except:pass
    tot=sum(s['memory'].values())or 1;used=s['memory']['active']+s['memory']['wired']+s['memory']['compressed']
    s['memory']['total']=tot;s['memory']['used']=used;s['memory']['pct']=int(used*100/tot)
    cpu=sh("top -l 1 -s 0 2>/dev/null | head -8");s['cpu']={'user':0,'sys':0,'idle':100,'pct':0}
    for line in cpu.split('\n'):
        if 'CPU' in line:
            nums=re.findall(r'([\d.]+)%',line)
            if len(nums)>=2:s['cpu']['user']=float(nums[0]);s['cpu']['sys']=float(nums[1]);s['cpu']['idle']=float(nums[2]) if len(nums)>2 else 0
            s['cpu']['pct']=round(s['cpu']['user']+s['cpu']['sys'],1)
    ps_out=sh("ps aux | sort -k4 -rn | head -25");s['processes']=[]
    for line in ps_out.split('\n'):
        p=line.split(None,10)
        if len(p)>=11 and p[0]!='USER':
            try:s['processes'].append({'pid':int(p[1]),'cpu':float(p[2]),'mem':float(p[3]),'name':p[10][:55]})
            except:pass
    ip=sh("ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null")or'disconnected'
    ssid=sh("/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I 2>/dev/null | awk '/ SSID/{print $2}'")
    s['network']={'ip':ip,'ssid':ssid}
    batt=sh("pmset -g batt 2>/dev/null");bm=re.findall(r'(\d+)%',batt)
    s['battery']={'pct':int(bm[0]) if bm else 100,'charging':'charging' in batt.lower() or 'AC Power' in batt,'source':'AC' if 'AC Power' in batt else 'Battery'}
    s['os']={'version':sh("sw_vers -productVersion"),'name':sh("sw_vers -productName"),'arch':sh("uname -m"),'hostname':sh("hostname -s")}
    s['uptime']=sh("uptime | sed 's/.*up //' | sed 's/,.*//'")
    bd=sh("du -sh ~/Library/Application\\ Support/* 2>/dev/null | sort -hr | head -10",20)
    s['disk_breakdown']=[]
    for line in bd.split('\n'):
        p=line.split('\t',1)
        if len(p)==2 and p[0].strip():s['disk_breakdown'].append({'size':p[0].strip(),'path':p[1].strip().split('/')[-1]})
    return s

def bg():
    global stats_cache
    while True:
        try:
            ns=collect()
            with cache_lock:stats_cache=ns
        except:pass
        time.sleep(1)

class H(http.server.SimpleHTTPRequestHandler):
    def __init__(self,*a,**k):super().__init__(*a,directory=DASHBOARD_DIR,**k)
    def log_message(self,*a):pass
    def j(self,data,code=200):
        b=json.dumps(data,ensure_ascii=False).encode()
        self.send_response(code);self.send_header('Content-Type','application/json;charset=utf-8')
        self.send_header('Access-Control-Allow-Origin','*');self.send_header('Content-Length',str(len(b)));self.end_headers();self.wfile.write(b)
    def body(self):
        l=int(self.headers.get('Content-Length',0))
        return json.loads(self.rfile.read(l)) if l else {}
    def do_OPTIONS(self):
        self.send_response(200);self.send_header('Access-Control-Allow-Origin','*')
        self.send_header('Access-Control-Allow-Methods','GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers','Content-Type');self.end_headers()
    def mac_ctx(self):
        import datetime
        with cache_lock:s=dict(stats_cache)
        return f"[Mac: CPU {s.get('cpu',{}).get('pct',0)}% | RAM {s.get('memory',{}).get('pct',0)}% ({s.get('memory',{}).get('free',0)}MB free) | Disk {s.get('disk',{}).get('pct',0)}% | Battery {s.get('battery',{}).get('pct',0)}% {'⚡' if s.get('battery',{}).get('charging') else '🔋'} | IP {s.get('network',{}).get('ip','?')} | {datetime.datetime.now().strftime('%a %b %d %Y %I:%M %p')}]"

    def do_GET(self):
        p=self.path.split('?')[0]
        qs=dict(urllib.parse.parse_qsl(urllib.parse.urlparse(self.path).query))
        if p=='/api/stats':
            with cache_lock:self.j(stats_cache)
        elif p=='/api/purge':
            sh("sudo purge 2>/dev/null",20);self.j({'result':'✅ RAM purged successfully'})
        elif p=='/api/clean':
            steps=["sudo rm -rf /private/var/folders/*/T/* 2>/dev/null","rm -rf ~/Library/Caches/* 2>/dev/null","npm cache clean --force 2>/dev/null","brew cleanup -s 2>/dev/null","rm -rf ~/Library/Developer/Xcode/DerivedData/* 2>/dev/null","docker system prune -af 2>/dev/null","sudo purge 2>/dev/null"]
            [sh(c,30) for c in steps]
            self.j({'result':'✅ Deep clean complete!\nCleared: system temp, user caches, npm, brew, Xcode, Docker, RAM\nReboot for System Data to recalculate.'})
        elif p=='/api/scan':
            disk=sh("df -h 2>/dev/null | head -6",10)
            large=sh("du -sh ~/Library/Application\\ Support/* 2>/dev/null | sort -hr | head -8",20)
            caches=sh("du -sh ~/Library/Caches/* 2>/dev/null | sort -hr | head -5",15)
            ollama=sh("du -sh ~/.ollama 2>/dev/null | cut -f1",5)or'not installed'
            self.j({'result':f"=== DISK ===\n{disk}\n\n=== TOP APP SUPPORT ===\n{large}\n\n=== CACHES ===\n{caches}\n\n=== OLLAMA ===\n{ollama}"})
        elif p=='/api/killhogs':
            with cache_lock:procs=sorted(stats_cache.get('processes',[]),key=lambda x:x['mem'],reverse=True)[:5]
            r='\n'.join([f"PID {p['pid']} — {p['name'].split('/')[-1]} — RAM:{p['mem']:.1f}% CPU:{p['cpu']:.1f}%" for p in procs])
            self.j({'result':r or'No hogs found','processes':procs})
        elif p=='/api/wifi':
            ip=sh("ipconfig getifaddr en0 2>/dev/null||ipconfig getifaddr en1 2>/dev/null")
            ssid=sh("/System/Library/PrivateFrameworks/Apple80211.framework/Versions/Current/Resources/airport -I 2>/dev/null|awk '/ SSID/{print $2}'")
            ping=sh("ping -c 4 8.8.8.8 2>&1|tail -3",15)
            spd=sh("curl -o /dev/null -s -w '%{speed_download}' https://speed.cloudflare.com/__down?bytes=500000 2>/dev/null",20)
            try:mbps=f"{float(spd)/131072:.2f} Mbps"if spd else"N/A"
            except:mbps="N/A"
            self.j({'result':f"📶 SSID: {ssid or'unknown'}\n🌐 IP: {ip or'disconnected'}\n📡 Ping:\n{ping}\n⚡ Speed: ~{mbps}"})
        elif p=='/api/doctor':
            def chk(cmd,name):v=sh(cmd,8);return f"{'✅' if v and '✗' not in v else '❌'} {name:15} {v or 'not installed'}"
            checks=[chk("node --version 2>/dev/null",'Node.js'),chk("python3 --version 2>/dev/null",'Python3'),chk("brew --version 2>/dev/null|head -1",'Homebrew'),chk("git --version 2>/dev/null",'Git'),chk("jq --version 2>/dev/null",'jq'),chk("sox --version 2>/dev/null|head -1",'sox (voice)'),chk("fdupes --version 2>/dev/null|head -1",'fdupes')]
            keys=load_keys()
            checks+=[f"{'✅' if keys.get('OPENROUTER_API_KEY') else '❌'} Chinna AI Key   {'configured' if keys.get('OPENROUTER_API_KEY') else 'not set'}",f"{'✅' if keys.get('OPENAI_API_KEY') else '⚪'} OpenAI Key      {'configured' if keys.get('OPENAI_API_KEY') else 'not set (optional)'}",f"{'✅' if keys.get('TELEGRAM_BOT_TOKEN') else '⚪'} Telegram Bot    {'configured' if keys.get('TELEGRAM_BOT_TOKEN') else 'not set (optional)'}"]
            self.j({'result':'\n'.join(checks)})
        elif p=='/api/brew':
            pkgs=sh("brew list --formula 2>/dev/null|head -40",15)or'Not installed'
            self.j({'result':f"🍺 Installed packages:\n{pkgs}\n\nMissing? Run: chinna brew in terminal"})
        elif p=='/api/bot':
            tok=getkey('TELEGRAM_BOT_TOKEN')
            if not tok:self.j({'result':'❌ Not configured. Set Telegram token in Settings.'});return
            info=sh(f"curl -s 'https://api.telegram.org/bot{tok}/getMe' 2>/dev/null",10)
            try:d=json.loads(info);self.j({'result':f"✅ Bot active: @{d['result']['username']}"if d.get('ok')else'❌ Invalid token'})
            except:self.j({'result':'❌ Could not connect'})
        elif p=='/api/listen':
            self.j({'result':'voice_ready'})
        elif p=='/api/time':
            import datetime;self.j({'result':datetime.datetime.now().strftime('%A, %B %d %Y — %I:%M:%S %p')})
        elif p=='/api/weather':
            city=sh("curl -s 'https://ipapi.co/city' 2>/dev/null",5)or'Hyderabad'
            w=sh(f"curl -s 'wttr.in/{city}?format=3' 2>/dev/null",8)or'Weather unavailable'
            self.j({'result':w,'city':city})
        elif p=='/api/ports':
            r=sh("lsof -iTCP -sTCP:LISTEN -n -P 2>/dev/null|awk 'NR>1{printf \"%-8s %-20s %s\\n\",$2,$9,$1}'|sort -u|head -20",15)
            self.j({'result':r or'No active ports'})
        elif p=='/api/get_keys':
            keys=load_keys()
            def mask(k):return k[:8]+'...'+k[-4:] if k and len(k)>12 else('set'if k else'')
            self.j({'chinna_ai_set':bool(keys.get('OPENROUTER_API_KEY')),'openai_set':bool(keys.get('OPENAI_API_KEY')),'telegram_set':bool(keys.get('TELEGRAM_BOT_TOKEN')),'chinna_ai_masked':mask(keys.get('OPENROUTER_API_KEY','')),'openai_masked':mask(keys.get('OPENAI_API_KEY',''))})
        elif p=='/api/files':
            tab=qs.get('tab','large');files=[]
            if tab=='large':
                out=sh("find ~ -maxdepth 7 -size +50M -not -path '*/.Trash/*' -not -path '*/System/Library/*' -not -path '*/.git/*' 2>/dev/null|head -25",25)
                for f in[x for x in out.split('\n') if x]:
                    sz=sh(f"du -sh '{f}' 2>/dev/null|cut -f1",5);name=os.path.basename(f);ext=name.split('.')[-1].lower() if'.'in name else''
                    icons={'zip':'🗜️','dmg':'💿','app':'📦','pkg':'📦','mov':'🎬','mp4':'🎬','pdf':'📄','ipa':'📱'}
                    files.append({'name':name,'path':f,'size':sz or'?','icon':'📁'if os.path.isdir(f)else icons.get(ext,'📄'),'type':'dir'if os.path.isdir(f)else'file'})
            elif tab=='downloads':
                dl=os.path.expanduser('~/Downloads')
                try:
                    entries=sorted(os.listdir(dl),key=lambda x:os.path.getsize(os.path.join(dl,x)) if os.path.exists(os.path.join(dl,x)) else 0,reverse=True)[:25]
                    for name in entries:
                        fp=os.path.join(dl,name)
                        try:
                            sz=os.path.getsize(fp);sz_str=f"{sz//1048576}MB"if sz>1048576 else f"{sz//1024}KB"
                            ext=name.split('.')[-1].lower() if'.'in name else''
                            icons={'zip':'🗜️','dmg':'💿','app':'📦','pkg':'📦','mov':'🎬','mp4':'🎬','pdf':'📄'}
                            files.append({'name':name,'path':fp,'size':sz_str,'icon':'📁'if os.path.isdir(fp)else icons.get(ext,'📄'),'type':'dir'if os.path.isdir(fp)else'file'})
                        except:pass
                except:pass
            elif tab=='dupes':
                out=sh("fdupes -r ~/Downloads ~/Documents 2>/dev/null|head -50",30)
                if out and out.strip():
                    for f in[x for x in out.split('\n') if x and not x.startswith('\n')]:
                        sz=sh(f"du -sh '{f}' 2>/dev/null|cut -f1",3)
                        files.append({'name':os.path.basename(f),'path':f,'size':sz or'?','icon':'📄','type':'dupe'})
                if not files:files=[{'name':'No duplicates found! ✅','path':'','size':'','icon':'✅','type':'info'}]
            self.j({'files':files,'count':len(files),'tab':tab})
        elif p in('/',''): self.path='/index.html';super().do_GET()
        else:super().do_GET()

    def do_POST(self):
        p=self.path;b=self.body()
        if p=='/api/chat':
            prompt=b.get('prompt','');free=not b.get('use_pro',False);use_oai=b.get('use_openai',False)
            file_b64=b.get('file_b64');file_mime=b.get('file_mime')
            # Inject mac context if relevant
            lp=prompt.lower()
            if any(w in lp for w in['mac','disk','ram','memory','cpu','battery','wifi','time','date','weather','storage','process','app','slow','speed']):
                prompt=f"You are Chinna, sarcastic Mac assistant. {self.mac_ctx()}\nAnswer in user's language (Telugu/Hindi/English/Tinglish). Be helpful and sarcastic.\n\nUser: {prompt}"
            if use_oai:
                result,model=call_openai(prompt,file_b64=file_b64,file_mime=file_mime)
                if result is None:result,model=call_ai(prompt,free=free,file_b64=file_b64,file_mime=file_mime)
            else:
                result,model=call_ai(prompt,free=free,file_b64=file_b64,file_mime=file_mime)
            if result is None:
                if model=='no_key':self.j({'error':'no_key','result':'Set your Chinna AI API key in Settings ⚙️'})
                else:self.j({'error':'failed','result':'AI request failed — try again'})
            else:self.j({'result':result,'model':model})
        elif p=='/api/save_keys':
            keys={};
            if b.get('chinna_ai_key'):keys['OPENROUTER_API_KEY']=b['chinna_ai_key']
            if b.get('openai_key'):keys['OPENAI_API_KEY']=b['openai_key']
            if b.get('telegram_token'):keys['TELEGRAM_BOT_TOKEN']=b['telegram_token']
            if b.get('telegram_chat'):keys['TELEGRAM_CHAT_ID']=b['telegram_chat']
            save_keys(keys);self.j({'result':'✅ Keys saved'})
        elif p=='/api/kill':
            pid=b.get('pid')
            if pid:sh(f"kill -9 {pid} 2>/dev/null",5);self.j({'result':f'Terminated {pid}'})
            else:self.j({'error':'No PID'},400)
        elif p=='/api/exec':
            cmd=b.get('cmd','').strip()
            if not cmd:self.j({'error':'No command'});return
            if any(x in cmd for x in SAFE_BLOCK):self.j({'stdout':'','stderr':'⚠️ Blocked for safety','code':1});return
            out,err,code=sh2(cmd,b.get('timeout',30));self.j({'stdout':out,'stderr':err,'code':code})
        elif p=='/api/trash':
            fp=b.get('path','')
            if fp and os.path.exists(fp):sh(f"osascript -e 'tell application \"Finder\" to delete POSIX file \"{fp}\"' 2>/dev/null",10);self.j({'result':f'Trashed: {os.path.basename(fp)}'})
            else:self.j({'error':'File not found'},404)
        elif p=='/api/delete':
            fp=b.get('path','')
            if fp and'..'not in fp and os.path.exists(fp):sh(f"rm -rf '{fp}' 2>/dev/null",20);self.j({'result':f'Deleted: {os.path.basename(fp)}'})
            else:self.j({'error':'File not found'},404)
        elif p=='/api/reveal':
            fp=b.get('path','')
            if fp:sh(f"open -R '{fp}' 2>/dev/null &",5)
            self.j({'result':'Revealed in Finder'})
        elif p=='/api/openterm':
            sh("open -a iTerm 2>/dev/null||open -a Terminal 2>/dev/null",5);self.j({'result':'Terminal opened'})
        elif p=='/api/git-commit':
            d=b.get('dir','.');msg=b.get('msg','')
            if not msg:
                diff=sh(f"cd '{d}'&&git add -A&&git diff --cached 2>/dev/null|head -100",15)
                ai_msg,_=call_ai(f"Write a concise git commit message (max 72 chars) for this diff. Reply with ONLY the message:\n{diff}")
                msg=(ai_msg or'chore: update').strip().split('\n')[0][:72]
            out,err,code=sh2(f"cd '{d}'&&git add -A&&git commit -m '{msg}' 2>&1",20)
            self.j({'result':out or err or f'Committed: {msg}','message':msg})
        elif p=='/api/git-push':
            d=b.get('dir','.');out,err,code=sh2(f"cd '{d}'&&git push 2>&1",30);self.j({'result':out or err or'Pushed'})
        elif p=='/api/deploy':
            d=b.get('dir','.');platform=b.get('platform','auto')
            if platform=='vercel'or os.path.exists(os.path.join(d,'vercel.json')):r=sh(f"cd '{d}'&&vercel --prod 2>&1",60)
            elif platform=='netlify'or os.path.exists(os.path.join(d,'netlify.toml')):r=sh(f"cd '{d}'&&netlify deploy --prod 2>&1",60)
            else:r='No deployment config found. Add vercel.json or netlify.toml first.'
            self.j({'result':r})
        elif p=='/api/deletedupes':
            r=sh("fdupes -rdN ~/Downloads 2>/dev/null|tail -10",60);self.j({'result':r or'✅ Duplicates removed'})
        elif p=='/api/voice-transcribe':
            audio_b64=b.get('audio_b64','');lang=b.get('lang','')
            if not audio_b64:self.j({'error':'No audio','text':''});return
            key=getkey('OPENAI_API_KEY')or getkey('OPENROUTER_API_KEY')
            if not key:self.j({'text':'','error':'No API key for transcription'});return
            try:
                audio=base64.b64decode(audio_b64)
                boundary='chinna_bnd'
                parts=[f'--{boundary}\r\nContent-Disposition: form-data; name="model"\r\n\r\nwhisper-1'.encode(),
                       f'--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="audio.webm"\r\nContent-Type: audio/webm\r\n\r\n'.encode()+audio+b'\r\n',
                       f'--{boundary}--'.encode()]
                body_data=b'\r\n'.join(parts)
                req=urllib.request.Request('https://api.openai.com/v1/audio/transcriptions',data=body_data,
                    headers={'Authorization':f'Bearer {key}','Content-Type':f'multipart/form-data; boundary={boundary}'})
                with urllib.request.urlopen(req,timeout=30)as resp:
                    d=json.loads(resp.read());self.j({'text':d.get('text','')})
            except Exception as e:self.j({'text':'','error':str(e)})
        else:self.j({'error':f'Unknown: {p}'},404)

def install_launchagent():
    plist_dir=os.path.expanduser('~/Library/LaunchAgents')
    plist_path=os.path.join(plist_dir,'com.chinna.dashboard.plist')
    srv=os.path.join(CHINNA_HOME,'dashboard_server.py')
    py=sh("which python3")
    os.makedirs(plist_dir,exist_ok=True)
    plist=f'''<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict><key>Label</key><string>com.chinna.dashboard</string>
<key>ProgramArguments</key><array><string>{py}</string><string>{srv}</string><string>{PORT}</string></array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
<key>StandardOutPath</key><string>{CHINNA_HOME}/dashboard.log</string>
<key>StandardErrorPath</key><string>{CHINNA_HOME}/dashboard.log</string>
<key>EnvironmentVariables</key><dict><key>CHINNA_HOME</key><string>{CHINNA_HOME}</string><key>HOME</key><string>{HOME}</string><key>PATH</key><string>/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin</string></dict>
</dict></plist>'''
    with open(plist_path,'w')as f:f.write(plist)
    sh(f"launchctl unload '{plist_path}' 2>/dev/null")
    sh(f"launchctl load '{plist_path}'")
    print(f"✅ Auto-launch installed")

if __name__=='__main__':
    if'--launchagent'in sys.argv:install_launchagent();sys.exit(0)
    t=threading.Thread(target=bg,daemon=True);t.start();time.sleep(1.5)
    print(f"Chinna V4-Pro: http://localhost:{PORT}",flush=True)
    http.server.HTTPServer(('',PORT),H).serve_forever()
