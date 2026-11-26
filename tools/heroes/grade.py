import numpy as np, sys
from PIL import Image, ImageFilter
def grade(src,out,warm_side=0.75,mood='day'):
    im=Image.open(src).convert('RGB'); a=np.asarray(im).astype(np.float32)/255; H,W,_=a.shape
    r,g,b=a[...,0],a[...,1],a[...,2]; lum=.299*r+.587*g+.114*b; mx=a.max(2); mn=a.min(2); sat=(mx-mn)/(mx+1e-4)
    yy=np.arange(H)[:,None]/H; xx=np.arange(W)[None,:]/W
    # sky: bright, unsaturated, bluish-grey, in the upper part
    sky=((lum>.62)&(sat<.22)&(b>=r-.02)&(yy<.5)).astype(np.float32)
    # keep only the region connected to the top: fill downwards per column until first non-sky
    run=np.cumprod(sky,axis=0); m=Image.fromarray((run*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(4)); m=np.asarray(m).astype(np.float32)/255
    hz=np.clip((run.sum(0)/H),0.05,0.5)  # horizon height per column
    hzm=np.median(hz)
    # new sky: deep blue zenith to a pale warm horizon, a warm glow on one side
    t=np.clip(yy/hzm,0,1)
    top=np.array([.16,.40,.74]); mid=np.array([.45,.66,.88]); hor=np.array([.93,.89,.82])
    sk=np.where(t[...,None]<.6, top+(mid-top)*(t[...,None]/.6), mid+(hor-mid)*((t[...,None]-.6)/.4))
    glow=np.exp(-((xx-warm_side)**2)/.08-((yy-hzm)**2)/.02)[...,None]
    gk=.35 if mood=='day' else .7
    sk=sk*(1-gk*glow)+np.array([1.0,.80,.55])*gk*glow
    # clouds from the original: what is brighter than its surroundings
    base=np.asarray(Image.fromarray((lum*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(30))).astype(np.float32)/255
    cl=np.clip((lum-base)*6+ (lum-.75)*1.2,0,1)[...,None]
    cl=np.asarray(Image.fromarray((cl[...,0]*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(1.2))).astype(np.float32)[...,None]/255
    skyimg=sk*(1-cl*.85)+np.array([1,.99,.97])*cl*.85
    # ground and water: more contrast and colour, warm highlights, cooler shadows, aerial haze at the horizon
    gnd=a.copy()
    l2=lum[...,None]
    gnd=l2+(gnd-l2)*1.45                                   # saturation
    gnd=np.clip((gnd-.5)*1.18+.5+.02,0,1)                   # contrast
    gnd=gnd*np.array([1.05,1.0,.93])*(1-l2*.0)+np.array([.0,.01,.03])*(1-l2)  # warm light, cool shadows
    haze=np.clip(1-(yy-hzm)/.14,0,1)[...,None]*(yy>hzm-0.01)[...,None]*.18
    gnd=gnd*(1-haze)+hor*haze
    # cockpit (dark, low-saturation, lower part): deepen blacks a little, keep the screens bright
    ck=((lum<.33)&(yy>.25)).astype(np.float32)
    ck=np.asarray(Image.fromarray((ck*255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(3))).astype(np.float32)[...,None]/255
    outa=gnd*(1-ck)+np.clip(a*.82,0,1)*ck
    scr=((sat>.35)&(lum>.25)&(yy>.45)).astype(np.float32)[...,None]
    outa=outa*(1-scr)+np.clip(a*1.12,0,1)*scr
    m3=m[...,None]
    outa=outa*(1-m3)+skyimg*m3
    # bloom on the brightest parts, vignette
    o=Image.fromarray((np.clip(outa,0,1)*255).astype(np.uint8))
    bl=np.asarray(o.filter(ImageFilter.GaussianBlur(18))).astype(np.float32)/255
    outa=1-(1-outa)*(1-np.clip(bl-.55,0,1)*.6)
    vg=1-.38*np.clip(((xx-.5)**2*1.1+(yy-.45)**2*1.6)*2.2,0,1)[...,None]
    outa=np.clip(outa*vg,0,1)
    if mood=='gold':
        l3=(.3*outa[...,0]+.6*outa[...,1]+.1*outa[...,2])[...,None]
        outa=np.clip(outa*np.array([1.08,.98,.84])*(.92+.12*l3),0,1)
        outa=l3+(outa-l3)*.85
    o=Image.fromarray((np.clip(outa,0,1)*255).astype(np.uint8)).filter(ImageFilter.UnsharpMask(radius=1.6,percent=70,threshold=2))
    o.save(out)
grade(sys.argv[1],sys.argv[2],float(sys.argv[3]) if len(sys.argv)>3 else .75,sys.argv[4] if len(sys.argv)>4 else 'day')
