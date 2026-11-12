import numpy as np, wave
sr=44100; T=20.0; t=np.arange(int(sr*T))/sr; rng=np.random.default_rng(7)
def n(m): return 440*2**((m-69)/12)
B=0.625; bar=4*B
chords=[[57,60,64,67],[53,57,60,64],[48,55,60,64],[55,59,62,67]]
L=np.zeros_like(t); R=np.zeros_like(t)
def add(sig,st,pan=0.0):
    i=int(st*sr); e=min(len(t),i+len(sig)); s=sig[:e-i]
    L[i:e]+=s*(1-pan)*0.9 if pan>0 else s; R[i:e]+=s*(1+pan)*0.9 if pan<0 else s
# pads: 2 bars per chord
for k in range(4):
    st=k*2*bar; dur=2*bar+1.5; tt=np.arange(int(dur*sr))/sr
    env=np.clip(tt/0.8,0,1)*np.clip((dur-tt)/1.5,0,1)
    sig=np.zeros_like(tt)
    for m in chords[k]:
        f=n(m); sig+=np.sin(2*np.pi*f*tt)+0.25*np.sin(2*np.pi*2*f*tt)+0.5*np.sin(2*np.pi*f*1.004*tt+1)
    sig=sig*env*0.035; sig+=np.sin(2*np.pi*n(chords[k][0]-24)*tt)*env*0.10
    if k==3: sig*=np.clip((T-st-tt)/2.5,0,1)
    add(sig,st)
# arp 8ths whole song
step=B/2; pat=[0,2,1,3,2,1,3,2]
for j in range(int(T/step)):
    tp=j*step; ch=chords[min(int(tp//(2*bar)),3)]; m=ch[pat[j%8]]+12
    tt=np.arange(int(0.8*sr))/sr; s=np.exp(-tt*5.5)*(np.sin(2*np.pi*n(m)*tt)+0.2*np.sin(2*np.pi*2*n(m)*tt))*(1-np.exp(-tt*300))*0.055
    add(s,tp,pan=0.3 if j%2 else -0.3)
# kick from 2.5s, every beat until 17.5
tp=2.5
while tp<17.4:
    tt=np.arange(int(0.45*sr))/sr; add(np.sin(2*np.pi*(48*tt+ (90/30)*(1-np.exp(-tt*30))))*np.exp(-tt*8)*0.30,tp); tp+=B
# soft clap on 2&4 from 5.0
tp=5.0+B
while tp<17.4:
    tt=np.arange(int(0.25*sr))/sr; add(rng.standard_normal(len(tt))*np.exp(-tt*28)*0.05,tp); tp+=2*B
# hats 8ths from 8.125
tp=8.125
while tp<17.4:
    tt=np.arange(int(0.06*sr))/sr; h=rng.standard_normal(len(tt)); h=np.diff(np.concatenate([[0],h]))*np.exp(-tt*80)*0.03
    add(h,tp+B/2,pan=0.4); tp+=B
# whoosh risers into cuts
def whoosh(end,dur=0.9,amp=0.10):
    tt=np.arange(int(dur*sr))/sr; x=rng.standard_normal(len(tt))
    # moving one-pole lowpass
    y=np.zeros_like(x); a=0.0
    for i in range(len(x)):
        c=0.02+0.5*(tt[i]/dur)**2; a+=c*(x[i]-a); y[i]=a
    env=(tt/dur)**2.2; add(y*env*amp*3,end-dur)
for c in (8.125,13.75): whoosh(c)
whoosh(17.5,1.4,0.14)
# impact at 17.5
tt=np.arange(int(2.0*sr))/sr
add((np.sin(2*np.pi*(38*tt+40/12*(1-np.exp(-tt*12))))*np.exp(-tt*2.2)*0.38+rng.standard_normal(len(tt))*np.exp(-tt*14)*0.04),17.5)
# final resolve chord (Am add9) 17.5-20
tt=np.arange(int(2.5*sr))/sr; s=np.zeros_like(tt)
for m in [57,64,69,71,72]: s+=np.sin(2*np.pi*n(m)*tt)*np.exp(-tt*0.9)
add(s*0.05*np.clip(tt/0.05,0,1),17.5)
# reverb
def verb(x):
    y=x.copy()
    for g,d in [(0.32,0.113),(0.24,0.229),(0.17,0.347),(0.11,0.521),(0.07,0.733)]:
        k=int(d*sr); y[k:]+=x[:-k]*g
    return y
L=verb(L); R=verb(R)
m=max(np.abs(L).max(),np.abs(R).max())/0.89; L/=m; R/=m
fade=np.ones_like(t); fade[t<0.3]=t[t<0.3]/0.3; fade[t>19.0]=np.clip((20-t[t>19.0])/1.0,0,1)
L=np.tanh(L*fade*1.1)/np.tanh(1.1); R=np.tanh(R*fade*1.1)/np.tanh(1.1)
y=(np.stack([L,R],1)*32000).astype(np.int16)
with wave.open('music.wav','wb') as w: w.setnchannels(2); w.setsampwidth(2); w.setframerate(sr); w.writeframes(y.tobytes())
print('ok')
