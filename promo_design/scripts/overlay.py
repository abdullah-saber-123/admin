import sys, math, os
from PIL import Image, ImageDraw, ImageFont, ImageFilter
CF='/tmp/claude-0/-home-user-admin/ca44433f-d67b-5f8a-a730-04c6d5092ed7/scratchpad/fonts/'
KF='/root/.claude/skills/synced/3507a64a-4feb-4b92-9835-1203b90f1e5c_6332d46a-83c0-4e86-a52e-ffe94b8282c1/canvas-design/canvas-fonts/'
K=1.5
W,H,FPS,T=1080,1920,30,20.0
INK=(13,14,16); GOLD=(227,178,60); CHALK=(245,242,234); STEEL=(154,161,171)
def F(name,size): return ImageFont.truetype(name,int(round(size*K)))
AR9=lambda s:F(CF+'cairo900.ttf',s); AR7=lambda s:F(CF+'cairo700.ttf',s); AR4=lambda s:F(CF+'cairo400.ttf',s)
BS=lambda s:F(KF+'BigShoulders-Bold.ttf',s); MONO=lambda s:F(KF+'GeistMono-Regular.ttf',s); JURA=lambda s:F(KF+'Jura-Light.ttf',s)
def ease(x): x=min(max(x,0),1); return 1-(1-x)**3
def eio(x): x=min(max(x,0),1); return x*x*(3-2*x)
def ar_size(d,txt,f):
    ws=txt.split(' '); gap=int(f.size*0.27); bbs=[d.textbbox((0,0),w,font=f,direction='rtl') for w in ws]
    return sum(b[2]-b[0] for b in bbs)+gap*(len(ws)-1), bbs, ws, gap
def draw_ar(img,txt,f,cx,y,fill,alpha,anchor='c'):
    """RTL Arabic (font lacks space glyph): lay words right-to-left. y = top of glyph box."""
    d=ImageDraw.Draw(img); tw,bbs,ws,gap=ar_size(d,txt,f)
    asc=min(b[1] for b in bbs)
    x=cx+tw//2 if anchor=='c' else cx  # right edge
    for w,b in zip(ws,bbs):
        x-=(b[2]-b[0]); d.text((x-b[0],y-asc),w,font=f,fill=fill+(int(255*alpha),),direction='rtl'); x-=gap
    return tw
def tracked(img,txt,f,x,y,fill,alpha,track,anchor='l'):
    d=ImageDraw.Draw(img); widths=[d.textlength(c,font=f) for c in txt]; tw=sum(widths)+track*(len(txt)-1)
    if anchor=='c': x=x-tw/2
    elif anchor=='r': x=x-tw
    for c,w in zip(txt,widths): d.text((x,y),c,font=f,fill=fill+(int(255*alpha),)); x+=w+track
    return tw
def shadowed(layer):
    a=layer.split()[3].filter(ImageFilter.GaussianBlur(10*K)); sh=Image.new('RGBA',layer.size,INK+(0,)); sh.putalpha(a.point(lambda v:int(v*0.55)))
    return Image.alpha_composite(sh,layer)
# precomputed scrim gradient (bottom)
def grad(h0,h1,maxa):
    g=Image.new('L',(1,H),0)
    for y in range(H):
        g.putpixel((0,y),int(maxa*255*eio((y-h0)/(h1-h0))) if y>h0 else 0)
    return g.resize((W,H))
SCRIM=grad(int(560*K),int(1180*K),0.62)
# timeline
B=0.625
lower=[ # (start,end,kicker,headline)
 (0.30,2.40,'SI4 SPORT','وجهتك الرياضية'),
 (3.85,5.55,'STORE 301','تجربة تسوق مختلفة'),
 (8.25,9.95,'APPAREL','أحدث الملابس الرياضية'),
 (11.35,13.60,'QUALITY','جودة وراحة وأناقة'),
 (13.85,15.05,'EQUIPMENT','معدات لكل رياضة'),
 (15.15,17.35,'ALL IN ONE','كل ما تحتاجه في مكان واحد'),
]
chapters=[(0.0,8.0,'01','THE STORE'),(8.125,13.65,'02','APPAREL'),(13.75,17.4,'03','GEAR')]
END=17.5
HB=AR9(58); KB=MONO(21)
def frame(t):
    img=Image.new('RGBA',(W,H),(0,0,0,0))
    # ---- lower thirds
    vis=0.0; txt=Image.new('RGBA',(W,H),(0,0,0,0))
    for s,e,k,h in lower:
        if s-0.05<=t<=e+0.05:
            a_in=ease((t-s)/0.45); a_out=1-eio((t-(e-0.28))/0.28); a=min(a_in,a_out); vis=max(vis,a)
            base=int(930*K)
            # gold rule grows from right edge of text column
            hb=HB; sz=58
            hb=AR9(sz)
            while ar_size(ImageDraw.Draw(txt),h,hb)[0]>W-120*K: sz-=2; hb=AR9(sz)
            hw,_,_,_=ar_size(ImageDraw.Draw(txt),h,hb)
            rw=int(64*K*ease((t-s)/0.5))
            right=W//2+hw//2
            d=ImageDraw.Draw(txt)
            if rw>0: d.rectangle((right-rw,base-int(6*K),right,base-int(3*K)),fill=GOLD+(int(255*a_out),))
            # kicker (mono, tracked) right-aligned to text column
            ka=ease((t-s-0.12)/0.4)*a_out
            tracked(txt,k,KB,right-rw-14*K if rw>0 else right,base-17*K,GOLD,ka,3.2*K,anchor='r')
            # headline slide-up
            ha=ease((t-s-0.08)/0.45)*a_out; dy=int(22*K*(1-ease((t-s-0.08)/0.55)))
            draw_ar(txt,h,hb,W//2,base+int(22*K)+dy,CHALK,ha)
    if vis>0:
        sc=Image.new('RGBA',(W,H),INK+(0,)); sc.putalpha(SCRIM.point(lambda v:int(v*vis))); img=Image.alpha_composite(img,sc)
        img=Image.alpha_composite(img,shadowed(txt))
    # ---- chapter marker (top right)
    for s,e,num,lab in chapters:
        if s<=t<=e:
            a=min(ease((t-s-0.1)/0.5),1-eio((t-(e-0.3))/0.3))
            if a<=0: continue
            L=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(L)
            xr=W-44*K; y=150*K
            nw=tracked(L,num,BS(48),xr,y-8*K,GOLD,a,1*K,anchor='r')
            lw=int(36*K*ease((t-s-0.15)/0.5))
            d.rectangle((xr-nw-14*K-lw,y+20*K,xr-nw-14*K,y+21.5*K),fill=CHALK+(int(200*a),))
            tracked(L,lab,MONO(18),xr-nw-14*K-lw-10*K,y+10*K,CHALK,a*0.92,2.6*K,anchor='r')
            img=Image.alpha_composite(img,shadowed(L))
    # ---- end card
    if t>=END-0.05:
        u=t-END
        dark=Image.new('RGBA',(W,H),INK+(int(255*0.70*eio(u/0.6)),)); img=Image.alpha_composite(img,dark)
        L=Image.new('RGBA',(W,H),(0,0,0,0)); d=ImageDraw.Draw(L)
        cy=470*K
        a1=ease((u-0.15)/0.6); dy=int(30*K*(1-ease((u-0.15)/0.7)))
        tracked(L,'SI4',BS(190),W/2,cy-150*K+dy,GOLD,a1,4*K,anchor='c')
        a2=ease((u-0.35)/0.6)
        tr=6+10*(1-ease((u-0.35)/0.9))
        tracked(L,'SPORT',JURA(40),W/2,cy+62*K,CHALK,a2,(tr+8)*K,anchor='c')
        rw=int(150*K*ease((u-0.5)/0.6))
        if rw>0: d.rectangle((W/2-rw,cy+132*K,W/2+rw,cy+133.5*K),fill=GOLD+(int(255*a2),))
        a3=ease((u-0.7)/0.5); dy3=int(18*K*(1-ease((u-0.7)/0.6)))
        draw_ar(L,'زورونا اليوم',AR9(66),W//2,int(cy+168*K)+dy3,CHALK,a3)
        a4=ease((u-0.95)/0.5)
        draw_ar(L,'وعيش الفرق',AR4(34),W//2,int(cy+262*K),STEEL,a4)
        a5=ease((u-1.2)/0.5)
        tracked(L,'STORE 301',MONO(20),W/2,cy+330*K,GOLD,a5*0.95,5*K,anchor='c')
        img=Image.alpha_composite(img,shadowed(L))
    return img
s,e=int(sys.argv[1]),int(sys.argv[2])
for i in range(s,e): frame(i/FPS).save(f'ov/{i:04d}.png',compress_level=1)
