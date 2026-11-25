# Local ENU frame for ENTO: origin = THR 35 (AIP AD 2.12), x = east, y = north (true), metres.
import math
from pyproj import Transformer
def dms(d,m,s): return d+m/60+s/3600
LAT0=dms(59,10,32.53); LON0=dms(10,15,31.95)
_fwd=Transformer.from_crs(4326,25833,always_xy=True)
_inv=Transformer.from_crs(25833,4326,always_xy=True)
_aeqd=Transformer.from_crs(f"+proj=aeqd +lat_0={LAT0} +lon_0={LON0} +ellps=GRS80 +units=m", 4326, always_xy=True)
_aeqd_inv=Transformer.from_crs(4326, f"+proj=aeqd +lat_0={LAT0} +lon_0={LON0} +ellps=GRS80 +units=m", always_xy=True)
def local_to_ll(E,N): return _aeqd.transform(E,N)        # -> lon,lat (arrays ok)
def ll_to_local(lon,lat): return _aeqd_inv.transform(lon,lat)
def local_to_utm(E,N):
    lon,lat=_aeqd.transform(E,N); return _fwd.transform(lon,lat)
# Aerodrome chart (AIP AD 2.24-1, vector PDF): page points -> UTM32 (chart is grid-north up), fitted on the
# runway pavement ends (AD 2.12 'RWY SFC end' coordinates of RWY 35 and RWY 17).
_u32=Transformer.from_crs(4326,25832,always_xy=True); _u32i=Transformer.from_crs(25832,4326,always_xy=True)
def _fit():
    import numpy as np
    pa=np.array([554.8,360.25]); pb=np.array([576.1,1052.4])            # north end, south end on the page
    ga=np.array(_u32.transform(dms(10,15,30.03),dms(59,11,56.21))); gb=np.array(_u32.transform(dms(10,15,32.11),dms(59,10,25.40)))
    P=complex(*(pb-pa))*complex(1,0); P=complex(pb[0]-pa[0],-(pb[1]-pa[1])); Gd=complex(*(gb-ga))
    k=Gd/P; return pa,ga,k
_PA,_GA,_K=_fit()
def page_to_local(x,y):
    import numpy as np
    z=complex(x-_PA[0],-(y-_PA[1]))*_K; ux,uy=_GA[0]+z.real,_GA[1]+z.imag
    lon,lat=_u32i.transform(ux,uy); return ll_to_local(lon,lat)
