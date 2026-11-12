import cv2, sys, subprocess, os
i=sys.argv[1]; M=sys.argv[2]
sr=cv2.dnn_superres.DnnSuperResImpl_create(); sr.readModel(M); sr.setModel('fsrcnn',2)
cap=cv2.VideoCapture(f'raw{i}.mp4'); fps=cap.get(cv2.CAP_PROP_FPS)
p=subprocess.Popen(['ffmpeg','-v','error','-y','-f','rawvideo','-pix_fmt','bgr24','-s','960x1708','-r',str(fps),'-i','-',
  '-vf','hqdn3d=1.5:1.5:3:3','-c:v','libx264','-crf','10','-preset','fast','-pix_fmt','yuv420p',f'up{i}.mp4'],stdin=subprocess.PIPE)
while True:
    ok,f=cap.read()
    if not ok: break
    p.stdin.write(sr.upsample(f).tobytes())
p.stdin.close(); p.wait(); print(i,'done',flush=True)
