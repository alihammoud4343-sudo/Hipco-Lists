# Builds the Claude board page from the phone app's index.html so both always have the same features.
import re,sys
src=open(sys.argv[1],encoding='utf-8').read()
arrows=re.search(r'<style>\s*/\* bigger blue dropdown arrows.*?</style>',src,re.S).group(0)
i=src.index('<script src="config.js'); i=src.index('</script>',i)+len('</script>')
body=src[i:].replace('<script src="hipco-db.js?v=14"></script>','').lstrip('\n')
# drop app-only trailing scripts (phone WhatsApp deep links, push, bell, service worker)
j=body.index('<script>\n// App: WhatsApp button opens')
body=body[:j]+'</body></html>\n'
body=body.replace('img/logo-white.png','/_blob/a2c867353ac6ba20ba4d0b85f8e8f2fd').replace('img/watermark.png','/_blob/f47aca6f5365fa7d9dfdf50cd86e825d').replace('img/letterhead.png','/_blob/3fc3ba67141110e6ccceb82d02dec31c')
m=re.search(r'<title>.*?</title>',body)
out=body[:m.end()]+'\n'+arrows+body[m.end():] if m else arrows+body
import os,json
root=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
cfg=re.search(r'window\.HIPCO_CFG\s*=\s*(\{.*?\});',open(os.path.join(root,'config.js'),encoding='utf-8').read(),re.S).group(1)
bridge='<script>window.HIPCO_CFG='+cfg+';</script>\n<script>\n'+open(os.path.join(root,'board_bridge.js'),encoding='utf-8').read()+'\n</script>\n'
bell='<script>\n'+open(os.path.join(root,'bell.js'),encoding='utf-8').read()+'\n</script>\n'
# bridge first (before the board code asks for its db), bell last (needs the page markup)
t=re.search(r'<title>.*?</title>',out,re.S)
if t: out=out[:t.end()]+'\n'+bridge+out[t.end():]
else: out=bridge+out
out=out[:out.rindex('</body>')]+bell+'</body></html>\n'
open(sys.argv[2],'w',encoding='utf-8').write(out)
print(len(out))
