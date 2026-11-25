import json, sys, urllib.request, ssl, os
sys.path.insert(0,'/home/claude/ento')
from geo import local_to_ll
import numpy as np
E=np.array([-3700,3700,-3700,3700.]); N=np.array([-11700,-11700,14200,14200.])
lo,la=local_to_ll(E,N); bb=f"{min(lo):.5f},{min(la):.5f},{max(lo):.5f},{max(la):.5f}"
print('bbox',bb)
ctx=ssl.create_default_context(cafile=os.path.expanduser('~/.ccr/ca-bundle.crt'))
url=f"https://nvdbapiles.atlas.vegvesen.no/vegnett/api/v4/veglenkesekvenser/segmentert?kartutsnitt={bb}&srid=4326&antall=1000"
out=[]
while url:
    rq=urllib.request.Request(url,headers={'X-Client':'nordap-ento','Accept':'application/json'})
    d=json.load(urllib.request.urlopen(rq,context=ctx,timeout=120))
    for o in d['objekter']:
        v=o.get('vegsystemreferanse',{}); vs=v.get('vegsystem',{}); st=v.get('strekning',{})
        out.append(dict(wkt=o['geometri']['wkt'],typ=o.get('typeVeg_sosi'),topo=o.get('topologinivå'),kat=vs.get('vegkategori'),fase=vs.get('fase'),
                        tg=st.get('trafikantgruppe'),felt=o.get('feltoversikt',[]),t=o.get('type'),slutt=o.get('sluttdato') or o.get('metadata',{}).get('sluttdato')))
    print(len(out),flush=True)
    if d['metadata']['returnert']<1000: break
    url=d['metadata']['neste']['href']
json.dump(out,open('/home/claude/ento/nvdb/links.json','w'))
