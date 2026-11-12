import subprocess
B=0.625; D=0.15
beats=[4,2,3,2,2,3,2,2,2,2,2,2,4]
tr=['','fade','fade','fade','fade','smoothleft','fade','fade','fade','fadewhite','fade','fade','fade']
cuts=[];c=0
for b in beats: cuts.append(c); c+=b*B
fc='';prev='0'
for i in range(1,13):
    fc+=f'[{prev}][{i}]xfade=transition={tr[i]}:duration={D}:offset={cuts[i]:.3f}[x{i}];'; prev=f'x{i}'
fc+=f'[{prev}]trim=duration=20,setpts=PTS-STARTPTS[v]'
cmd=['ffmpeg','-v','error','-y']
for i in range(13): cmd+=['-i',f'p{i}.mp4']
cmd+=['-filter_complex',fc,'-map','[v]','-c:v','libx264','-crf','12','-preset','fast','base.mp4']
subprocess.run(cmd,check=True); print(cuts)
