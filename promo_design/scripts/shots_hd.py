import subprocess, sys, os
W=sys.argv[1]; os.chdir(W)
U='/root/.claude/uploads/ca44433f-d67b-5f8a-a730-04c6d5092ed7/'
V1=U+'58a75622-WhatsApp_Video_2026-11-10_at_7.27.13_PM.mp4'; V2=U+'27bd5b07-WhatsApp_Video_2026-11-10_at_7.27.26_PM.mp4'
V3=U+'c1d73d53-WhatsApp_Video_2026-11-10_at_7.27.58_PM_1.mp4'; V4=U+'b5627bea-WhatsApp_Video_2026-11-10_at_7.27.58_PM.mp4'
N=U+'d9a736f1-WhatsApp_Video_2026-11-10_at_8.12.28_PM_1.mp4'
B=0.625; D=0.15
shots=[(N,0.0,4,'N'),(N,2.6,2,'N'),(N,9.0,3,'N'),(N,13.5,2,'N'),(N,27.0,2,'N'),(V1,12.0,3,'O'),(V2,17.0,2,'O'),
       (V4,1.0,2,'O'),(V1,34.2,2,'O'),(V3,35.85,2,'O'),(N,36.0,2,'N'),(V3,29.8,2,'O'),(V1,37.0,4,'O')]
G={'O':"eq=gamma=1.16:brightness=0.025:contrast=1.07:saturation=1.28,curves=all='0/0.02 0.25/0.29 0.5/0.59 0.8/0.87 1/0.99'",
   'N':"eq=gamma=1.03:contrast=1.06:saturation=1.24,curves=all='0/0.02 0.25/0.27 0.5/0.54 0.8/0.84 1/0.99'"}
tl=[]
ONLY=[int(x) for x in sys.argv[2].split(',')] if len(sys.argv)>2 else None
for i,(f,st,beats,g) in enumerate(shots):
    if ONLY is not None and i not in ONLY: continue
    L=beats*B+(D if i<len(shots)-1 else 0)
    src=L/1.5+0.25
    # 1) cut source with margin, 2) stabilize
    subprocess.run(['ffmpeg','-v','error','-y','-i',f'up{i}.mp4','-vf',f'vidstabdetect=shakiness=6:accuracy=12:result=hr{i}.trf','-f','null','-'],check=True)
    frames=int(round(L*30))
    stab="" if i==0 else f"vidstabtransform=input=hr{i}.trf:smoothing=20:optzoom=1:interpol=bicubic,"
    zs="0.035" if i==0 else "0.06"
    vf=(stab+
        f"setpts=1.5*(PTS-STARTPTS),fps=30,scale=2160:3840:flags=lanczos,"
        f"zoompan=z='1.0+{zs}*on/{frames}':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=1:s=1080x1920:fps=30,"
        f"{G[g]},colorbalance=rs=0.02:bs=-0.015:rh=0.01,unsharp=5:5:0.45,trim=duration={L:.3f},setsar=1,format=yuv420p")
    subprocess.run(['ffmpeg','-v','error','-y','-i',f'up{i}.mp4','-vf',vf,'-c:v','libx264','-crf','12','-preset','fast',f'h{i}.mp4'],check=True)
    print(i,'ok',L,flush=True)
