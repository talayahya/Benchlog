"""Illustrated, narrated Benchlog demonstration. Does not fabricate app UI.

Actual captures appear beside deliberately labelled explanatory model drawings.
Audio timing comes from the supplied narration manifest. A supplied licensed
music excerpt is faded and ducked under narration and input samples.
Use --preview 32:58 before committing a complete render. Existing video is never
overwritten by default. Python dependencies: Pillow and imageio-ffmpeg.
"""
from __future__ import annotations
import argparse
import json
import math
import re
import subprocess
import sys
import wave
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT.parent / "tmp/benchlog_video_tools"))
from PIL import Image, ImageDraw, ImageFont, ImageFilter
import imageio_ffmpeg

W, H = 1280, 720
INK = (23, 43, 50)
PAPER = (248, 250, 248)
TEAL = (6, 106, 99)
RUST = (183, 63, 39)
GREY = (81, 100, 106)
LINE = (210, 221, 218)
WHITE = (255, 255, 255)
A_TAU = 0.0010266827319736407
B_TAU = 0.0001
B_SCALE = 0.09861510953929359
SCENES = ["opening", "capture", "models", "test", "result", "limits", "closing"]
DEFAULT_LENGTHS = [14, 23, 27, 29, 27, 24, 23]


def clamp(x, a=0.0, b=1.0):
    return max(a, min(b, x))


def ease(x):
    x = clamp(x)
    return x*x*(3-2*x)


@lru_cache(maxsize=48)
def font(size, bold=False, mono=False):
    name = "consola.ttf" if mono else "segoeuib.ttf" if bold else "segoeui.ttf"
    return ImageFont.truetype(f"C:/Windows/Fonts/{name}", size)


def txt(draw, xy, text, size=24, fill=INK, bold=False, mono=False):
    draw.text(xy, text, font=font(size, bold, mono), fill=fill)


def centre(draw, y, text, size=40, fill=INK, bold=False):
    face=font(size,bold)
    x=(W-draw.textlength(text,font=face))/2
    draw.text((x,y),text,font=face,fill=fill)


def wrap(draw,text,size,width,bold=False):
    lines=[]; line=""
    for word in text.split():
        new=(line+" "+word).strip()
        if line and draw.textlength(new,font=font(size,bold))>width:
            lines.append(line);line=word
        else: line=new
    if line:lines.append(line)
    return lines


def fade_text(im, xy, text, size, alpha, fill=INK, bold=False):
    layer=Image.new("RGBA",(W,H))
    ImageDraw.Draw(layer).text(xy,text,font=font(size,bold),fill=(*fill,round(clamp(alpha)*255)))
    im.paste(layer,(0,0),layer)


@lru_cache(maxsize=24)
def capture(name):
    with Image.open(ROOT/"docs/video/captures"/name) as im:
        return im.convert("RGB")


def capture_in(im,name,rect,crop=None,zoom=1.0):
    source=capture(name)
    if crop:source=source.crop(tuple(map(round,crop)))
    target_w,target_h=rect[2]-rect[0],rect[3]-rect[1]
    scale=min(target_w/source.width,target_h/source.height)
    out=source.resize((round(source.width*scale),round(source.height*scale)),Image.Resampling.LANCZOS)
    x=rect[0]+(target_w-out.width)//2;y=rect[1]+(target_h-out.height)//2
    ImageDraw.Draw(im).rounded_rectangle(rect, radius=14, fill=WHITE, outline=LINE,width=1)
    im.paste(out,(x,y))
    return x,y,scale


def header(im,section,dark=False):
    d=ImageDraw.Draw(im)
    color=WHITE if dark else INK
    txt(d,(56,28),"benchlog.",25,color,True)
    txt(d,(1110,35),section,14,(167,190,190) if dark else GREY)


def footer(im,dark=False):
    d=ImageDraw.Draw(im)
    txt(d,(56,692),"Illustrated demo · real app captures · synthetic test data, input voice and narration",12,(167,190,190) if dark else GREY)


def pill(d,xy,label,color=TEAL,bg=(226,239,235),size=17):
    x,y=xy;face=font(size,True);width=d.textlength(label,font=face)+24
    d.rounded_rectangle((x,y,x+width,y+32),radius=16,fill=bg)
    txt(d,(x+12,y+4),label,size,color,True)


def schematic(im,rect,progress=1.0,dark=False,highlight=None):
    d=ImageDraw.Draw(im);x,y,x2,y2=rect;mid=(y+y2)/2
    color=(220,237,233) if dark else INK
    xx=[x,x+(x2-x)*.27,x+(x2-x)*.48,x+(x2-x)*.72,x2]
    d.line((xx[0],mid,xx[1],mid),fill=color,width=3)
    d.rectangle((xx[1],mid-14,xx[2],mid+14),outline=RUST if highlight=="R" else color,width=3)
    d.line((xx[2],mid,xx[4],mid),fill=color,width=3)
    capx=xx[3]
    d.line((capx,mid,capx,mid+55),fill=color,width=3)
    cc=RUST if highlight=="C" else color
    d.line((capx-25,mid+55,capx+25,mid+55),fill=cc,width=3)
    d.line((capx-25,mid+66,capx+25,mid+66),fill=cc,width=3)
    d.line((capx,mid+66,capx,mid+100),fill=color,width=3)
    for i in range(3):d.line((capx-24+i*7,mid+100+i*7,capx+24-i*7,mid+100+i*7),fill=color,width=3)
    for px in [xx[0],xx[4]]:d.ellipse((px-5,mid-5,px+5,mid+5),fill=color)
    txt(d,(xx[1]+20,mid-58),"R",26,color,True)
    txt(d,(capx+37,mid+47),"C",26,color,True)
    txt(d,(xx[0]-20,mid+25),"input",20,color)
    txt(d,(xx[4]-35,mid+25),"output",20,color)
    for i in range(4):
        p=(progress*.16+i/4)%1
        px=x+p*(x2-x)
        d.ellipse((px-4,mid-4,px+4,mid+4),fill=(216,105,77) if dark else RUST)
    return im


def prediction(f,tau,scale=1):return 2*scale/math.hypot(1,2*math.pi*f*tau)


class ScaledDraw:
    """Draw vector panels at twice their output resolution for clean lines."""
    def __init__(self, image, scale=2):
        self.draw=ImageDraw.Draw(image);self.scale=scale
    def coords(self, value):
        if isinstance(value,(tuple,list)):return tuple(self.coords(x) for x in value)
        return value*self.scale
    def line(self, coords, **kw):
        if "width" in kw:kw["width"]=max(1,round(kw["width"]*self.scale))
        self.draw.line(self.coords(coords),**kw)
    def ellipse(self, coords, **kw):
        if "width" in kw:kw["width"]=max(1,round(kw["width"]*self.scale))
        self.draw.ellipse(self.coords(coords),**kw)
    def text(self, coords, text, **kw):
        if "font" in kw:kw["font"]=kw["font"].font_variant(size=round(kw["font"].size*self.scale))
        self.draw.text(self.coords(coords),text,**kw)


def plot(im,rect,reveal_a=1,reveal_b=1,test_frequency=None,anchor=True):
    vector=Image.new("RGBA",(W*2,H*2));d=ScaledDraw(vector);l,t,r,b=rect
    def xy(f,v):return l+(math.log10(f)-1)/4*(r-l),b-v/2*(b-t)
    for v in [0,.5,1,1.5,2]:
        yy=xy(10,v)[1];d.line((l,yy,r,yy),fill=LINE,width=1)
        txt(d,(l-58,yy-12),f"{v:g}",18,GREY,mono=True)
    for f,label in [(10,"10"),(100,"100"),(1000,"1k"),(10000,"10k"),(100000,"100k")]:
        xx=xy(f,0)[0];d.line((xx,t,xx,b),fill=(231,236,233),width=1)
        txt(d,(xx-20,b+12),label,18,GREY,mono=True)
    txt(d,(l-58,t-42),"Vpp",17,GREY,True)
    txt(d,(r-10,b+42),"Hz",17,GREY,True)
    for amount,tau,scale,color in [(reveal_a,A_TAU,1,RUST),(reveal_b,B_TAU,B_SCALE,TEAL)]:
        points=[xy(10**(1+4*i/240),prediction(10**(1+4*i/240),tau,scale)) for i in range(max(2,round(241*clamp(amount))))]
        if amount>0:d.line(points,fill=color,width=4,joint="curve")
    if anchor:
        ax,ay=xy(10000,.031)
        d.ellipse((ax-6,ay-6,ax+6,ay+6),fill=INK,outline=WHITE,width=2)
        d.line((ax,ay-7,ax,ay-56),fill=GREY,width=1)
        txt(d,(ax-82,ay-88),"10 kHz · 31 mVpp",17,INK,True)
    if test_frequency:
        xx=xy(test_frequency,0)[0]
        for yy in range(round(t),round(b),12):d.line((xx,yy,xx,yy+5),fill=GREY,width=1)
        for tau,scale,color in [(A_TAU,1,RUST),(B_TAU,B_SCALE,TEAL)]:
            px,py=xy(test_frequency,prediction(test_frequency,tau,scale))
            d.ellipse((px-6,py-6,px+6,py+6),fill=color,outline=WHITE,width=2)
    vector=vector.resize((W,H),Image.Resampling.LANCZOS)
    im.paste(vector,(0,0),vector)
    return xy


def scene_opening(t,duration):
    im=Image.new("RGB",(W,H),INK);header(im,"THE QUESTION",True)
    fade_text(im,(65,115),"31 mV",92,ease(t/1.0),WHITE,True)
    fade_text(im,(67,223),"A reading is not yet an explanation.",33,ease((t-1.2)/.7),(219,234,231))
    schematic(im,(690,205,1150,435),t,dark=True)
    lines=[("Has the circuit changed?",3.2), ("Is the measurement scaled?",5.5), ("What should you test next?",8)]
    for i,(text,delay) in enumerate(lines):
        fade_text(im,(72,350+i*65),text,31,ease((t-delay)/.7),WHITE,i==2)
    d=ImageDraw.Draw(im);txt(d,(770,500),"An RC low-pass experiment",20,(167,190,190))
    footer(im,True);return im


def scene_capture(t,duration):
    im=Image.new("RGB",(W,H),PAPER);header(im,"VOICE → EVIDENCE")
    d=ImageDraw.Draw(im);txt(d,(58,94),"Say it. Check it. Save it.",46,INK,True)
    labels=["Voice", "Pending", "Confirmed"]
    for i,label in enumerate(labels):
        a=ease((t-i*2)/.7)
        fade_text(im,(68+i*235,161),label,24,a,TEAL,True)
        if i<2:fade_text(im,(220+i*235,161),"→",24,a,GREY)
    if t<duration*.4:
        capture_in(im,"03-spoken-anchor.jpg",(60,215,1220,625),(285,285,1215,610))
    elif t<duration*.78:
        capture_in(im,"04-transcript.jpg",(60,215,790,625),(300,190,730,480))
        d=ImageDraw.Draw(im)
        txt(d,(855,305),"Your check",39,INK,True)
        txt(d,(855,360),"is the checkpoint.",29,GREY)
        txt(d,(855,422),"Correct it or confirm it.",20,GREY)
    else:
        capture_in(im,"05-frozen-predictions.jpg",(60,265,1220,550),(300,435,1210,595))
        d=ImageDraw.Draw(im);pill(d,(65,217),"Confirmed evidence",TEAL,(226,239,235),18)
    d=ImageDraw.Draw(im)
    pill(d,(900,162),"Real app capture",GREY,(232,237,233),16)
    txt(d,(65,644),"31 mV stays pending until you confirm it." if t<duration*.78 else "Now the same reading can anchor an investigation.",25,INK,True)
    footer(im);return im


def scene_models(t,duration):
    im=Image.new("RGB",(W,H),PAPER);header(im,"TWO EXPLANATIONS")
    d=ImageDraw.Draw(im);txt(d,(58,94),"Both models fit the first reading.",43,INK,True)
    txt(d,(60,153),"RC filter · input held at 2 Vpp · peak-to-peak amplitude",23,GREY)
    plot(im,(125,240,875,565),ease((t-5.9)/2.8),ease((t-9.7)/2.8))
    d=ImageDraw.Draw(im)
    fade_text(im,(960,260),"A",44,ease((t-5.9)/.7),RUST,True)
    fade_text(im,(960,320),"Slower response",22,ease((t-6.1)/.7),INK,True)
    fade_text(im,(960,355),"A larger R × C",18,ease((t-6.1)/.7),GREY)
    fade_text(im,(960,440),"B",44,ease((t-9.7)/.7),TEAL,True)
    fade_text(im,(960,500),"Different scale",22,ease((t-9.9)/.7),INK,True)
    fade_text(im,(960,535),"Every output scaled",18,ease((t-9.9)/.7),GREY)
    pill(d,(65,639),"Calculated model illustration",GREY,(232,237,233),16)
    footer(im);return im


def scene_test(t,duration):
    im=Image.new("RGB",(W,H),PAPER);header(im,"PREDICT BEFORE TESTING")
    d=ImageDraw.Draw(im)
    if t<2.7:
        centre(d,260,"What would tell them apart?",54,INK,True)
        centre(d,345,"Choose where the predictions disagree.",29,GREY)
    elif t<duration*.7:
        txt(d,(58,94),"At 80 Hz, the stories separate.",43,INK,True)
        move=ease((t-6.9)/2.3)
        f=10**(4+(math.log10(80)-4)*move)
        plot(im,(125,245,875,570),test_frequency=f)
        d=ImageDraw.Draw(im)
        fade_text(im,(945,260),"1.78 Vpp",41,ease((t-9.2)/.8),RUST,True)
        fade_text(im,(945,315),"A · Slower response",20,ease((t-9.2)/.8),GREY)
        fade_text(im,(945,430),"0.197 Vpp",41,ease((t-9.2)/.8),TEAL,True)
        fade_text(im,(945,485),"B · Different scale",20,ease((t-9.2)/.8),GREY)
        txt(d,(65,639),"Chosen from a finite frequency grid, not every possible test.",22,GREY)
    else:
        txt(d,(58,94),"Make the prediction first.",45,INK,True)
        capture_in(im,"08-receipt.jpg",(60,185,1220,610),(300,300,1210,575))
        d=ImageDraw.Draw(im);txt(d,(65,636),"The receipt fixes the models before new evidence arrives.",25,INK,True)
    footer(im);return im


def scene_result(t,duration):
    im=Image.new("RGB",(W,H),PAPER);header(im,"TEST THE PREDICTION")
    d=ImageDraw.Draw(im)
    early=t<duration*.4
    txt(d,(58,94),"New evidence. Same predictions.",43,INK,True)
    if early:
        capture_in(im,"09-spoken-result.jpg",(60,190,1220,605),(290,290,1215,610))
        d=ImageDraw.Draw(im);txt(d,(65,632),"Observed: 1.78 Vpp at 80 Hz. Check it, then confirm.",25,INK,True)
    else:
        capture_in(im,"12-result-detail.jpg",(60,190,1220,605),(300,90,1215,505))
        d=ImageDraw.Draw(im);txt(d,(65,632),"Closer to A. The models are not refitted to the answer.",25,INK,True)
    footer(im);return im


def scene_limits(t,duration):
    im=Image.new("RGB",(W,H),PAPER);header(im,"KEEP THE UNCERTAINTY")
    d=ImageDraw.Draw(im)
    if t<duration*.55:
        txt(d,(58,94),"A match is not a component diagnosis.",41,INK,True)
        schematic(im,(125,220,655,400),t,highlight="R" if int(t/2)%2==0 else "C")
        txt(d,(800,250),"R × C",69,INK,True)
        txt(d,(800,345),"One product.",28,GREY)
        txt(d,(800,390),"Many combinations.",28,GREY)
        txt(d,(65,621),"These measurements cannot tell which component changed.",26,INK,True)
    else:
        txt(d,(58,94),"Sometimes neither explanation fits.",43,INK,True)
        capture_in(im,"15-neither-model.jpg",(60,185,1220,610),(295,0,1210,395))
        d=ImageDraw.Draw(im);txt(d,(65,634),"Separate synthetic example: 0.8 Vpp at 80 Hz.",25,INK,True)
    footer(im);return im


def scene_closing(t,duration):
    im=Image.new("RGB",(W,H),INK);header(im,"THE NEXT EXPERIMENT",True)
    d=ImageDraw.Draw(im)
    centre(d,125,"A reason for the next experiment.",48,WHITE,True)
    labels=["SPEAK","CONFIRM","PREDICT","TEST"]
    for i,label in enumerate(labels):
        x=110+i*300
        d.ellipse((x,265,x+28,293),outline=(112,151,148),width=2)
        if i<3:d.line((x+28,279,x+300,279),fill=(74,112,112),width=2)
        fade_text(im,(x-17,320),label,22,ease((t-i*1.3)/.6),WHITE,True)
        if t>i*1.3:d.ellipse((x+6,271,x+22,287),fill=(217,105,77))
    centre(d,418,"Local voice · transparent maths · inspectable evidence",25,(188,211,207))
    centre(d,507,"talayahya.github.io/Benchlog",34,WHITE,True)
    centre(d,565,"Source, tests and AI disclosure: github.com/talayahya/Benchlog",21,(188,211,207))
    centre(d,615,"Next: test it with students at a real bench.",22,(188,211,207))
    centre(d,651,'Music: "Signal to Noise" by Scott Buckley · CC BY 4.0 · scottbuckley.com.au',12,(188,211,207))
    centre(d,671,"No Piano Melody mix · excerpted, faded and ducked · synthetic SoniaNeural narration",12,(188,211,207))
    footer(im,True);return im


RENDERERS=dict(zip(SCENES,[scene_opening,scene_capture,scene_models,scene_test,scene_result,scene_limits,scene_closing]))


def audio_duration(path):
    if str(path).lower().endswith(".wav"):
        with wave.open(str(path),"rb") as audio:return audio.getnframes()/audio.getframerate()
    result=subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),"-hide_banner","-i",str(path)],capture_output=True,text=True)
    match=re.search(r"Duration: (\d+):(\d+):(\d+\.\d+)",result.stderr)
    if not match:raise ValueError(f"Cannot read audio duration: {path}")
    a,b,c=map(float,match.groups());return a*3600+b*60+c


def timeline(manifest_path):
    spec=json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    base=(manifest_path.parent/ spec.get("base_dir",".")).resolve()
    cues=[];scenes=[];start=0
    for i,entry in enumerate(spec["scenes"]):
        kind=entry["kind"];cursor=float(entry.get("lead",.5))
        for item in entry.get("audio",[]):
            if "pause" in item:cursor+=float(item["pause"]);continue
            file=(base/item["file"]).resolve()
            length=audio_duration(file)
            cues.append({**item,"file":str(file),"start":start+cursor,"duration":length})
            cursor+=length+float(item.get("gap",.45))
        length=max(float(entry.get("min_duration",DEFAULT_LENGTHS[i])),cursor+float(entry.get("tail",1.3)))
        scenes.append({"kind":kind,"start":start,"duration":length})
        start+=length
    return spec,scenes,cues,start


def mix_audio(cues,duration,folder,music_path=None):
    folder.mkdir(parents=True,exist_ok=True)
    target=folder/"seminar-audio.wav"
    command=[imageio_ffmpeg.get_ffmpeg_exe(),"-hide_banner","-loglevel","error","-y"]
    for cue in cues:command +=["-i",cue["file"]]
    if music_path:
        command +=["-i",str(music_path)]
    filters=[];names=[]
    for i,cue in enumerate(cues):
        delay=round(cue["start"]*1000);gain=.85 if cue.get("type")=="input" else 1
        filters.append(f"[{i}:a]aresample=48000,aformat=channel_layouts=stereo,volume={gain},adelay={delay}|{delay},apad=whole_dur={duration}[a{i}]")
        names.append(f"[a{i}]")
    if not names:
        if music_path:
            command +=["-t",str(duration),"-ar","48000","-ac","2","-c:a","pcm_s16le",str(target)]
            subprocess.run(command,check=True,capture_output=True);return target
        return None
    filters.append("".join(names)+f"amix=inputs={len(names)}:normalize=0:duration=longest[voice]")
    if music_path:
        filters.append("[voice]asplit=2[vo][sc]")
        filters.append(f"[{len(cues)}:a]atrim=0:{duration},asetpts=PTS-STARTPTS,aresample=48000,aformat=channel_layouts=stereo,volume=0.16,afade=t=in:d=2,afade=t=out:st={max(0,duration-3)}:d=3[music]")
        filters.append("[music][sc]sidechaincompress=threshold=0.012:ratio=8:attack=40:release=450[bed]")
        filters.append("[vo][bed]amix=inputs=2:normalize=0,alimiter=limit=0.95[out]")
    else:filters.append("[voice]anull[out]")
    command +=["-filter_complex",";".join(filters),"-map","[out]","-t",str(duration),"-ar","48000","-ac","2","-c:a","pcm_s16le",str(target)]
    subprocess.run(command,check=True,capture_output=True)
    # Two-pass programme loudness: keep speech/music relationship, deliver a
    # normal listening level, and reserve true-peak headroom.
    ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
    first=subprocess.run([ffmpeg,"-hide_banner","-i",str(target),"-af","loudnorm=I=-16:LRA=11:TP=-1.5:print_format=json","-f","null","-"],capture_output=True,text=True,check=True)
    match=re.findall(r'\{\s*"input_i"[\s\S]*?\}',first.stderr)
    if not match:raise RuntimeError("Could not parse loudness measurements")
    measured=json.loads(match[-1])
    (folder/"loudness-first-pass.json").write_text(json.dumps(measured,indent=2),encoding="utf-8")
    normalized=folder/"seminar-audio-normalized.wav"
    settings=(f"loudnorm=I=-16:LRA=11:TP=-1.5:measured_I={measured['input_i']}:"
              f"measured_TP={measured['input_tp']}:measured_LRA={measured['input_lra']}:"
              f"measured_thresh={measured['input_thresh']}:offset={measured['target_offset']}:"
              "linear=true:print_format=json")
    second=subprocess.run([ffmpeg,"-hide_banner","-y","-i",str(target),"-af",settings,"-ar","48000","-c:a","pcm_s16le",str(normalized)],capture_output=True,text=True,check=True)
    final=re.findall(r'\{\s*"input_i"[\s\S]*?\}',second.stderr)
    if final:(folder/"loudness-second-pass.json").write_text(final[-1],encoding="utf-8")
    normalized.replace(target)
    return target


def frame_at(t,scenes):
    i=next((i for i,s in enumerate(scenes) if t<s["start"]+s["duration"]),len(scenes)-1)
    scene=scenes[i];local=t-scene["start"]
    frame=RENDERERS[scene["kind"]](local,scene["duration"])
    # Quiet half-second dissolve at meaningful scene boundaries.
    if i>0 and local<.5:
        prev=scenes[i-1];old=RENDERERS[prev["kind"]](prev["duration"]-.01,prev["duration"])
        frame=Image.blend(old,frame,ease(local/.5))
    return frame


def subtitle_cues(audio_cues):
    entries=[]
    examples={
        "investigation-anchor":"[Synthetic test voice] At ten kilohertz, output thirty-one millivolts.",
        "investigation-question":"[Synthetic test voice] What would tell these apart?",
        "investigation-result":"[Synthetic test voice] At eighty hertz, output one point seven eight volts.",
    }
    for cue in audio_cues:
        path=Path(cue["file"]);word_file=path.with_suffix(".words.json")
        if cue.get("type")=="input":
            entries.append((cue["start"]+.05,cue["start"]+cue["duration"]-.05,examples[path.stem]))
            continue
        if not word_file.is_file():continue
        words=json.loads(word_file.read_text(encoding="utf-8"));group=[]
        # Restore punctuation from the exact synthesis text when its tokens
        # align with the service's word boundaries.
        narration_manifest=path.parent/"manifest.json"
        if narration_manifest.is_file():
            metadata=json.loads(narration_manifest.read_text(encoding="utf-8"))
            clips=[clip for scene in metadata.get("scenes",[]) for clip in scene.get("clips",[])]
            clip=next((c for c in clips if c.get("id")==path.stem),None)
            if clip:
                tokens=clip["text"].split()
                norm=lambda s:re.sub(r"[^A-Za-z0-9]","",s).casefold()
                if len(tokens)==len(words) and all(norm(a)==norm(b["text"]) for a,b in zip(tokens,words)):
                    words=[{**word,"text":token} for word,token in zip(words,tokens)]
        for word in words:
            proposed=" ".join(w["text"] for w in group+[word])
            span=word["start"]+word["duration"]-group[0]["start"] if group else 0
            if group and (len(proposed)>90 or span>6.0):
                entries.append((cue["start"]+group[0]["start"],cue["start"]+group[-1]["start"]+group[-1]["duration"]+.12," ".join(w["text"] for w in group)))
                group=[]
            group.append(word)
            if word["text"].endswith((".","?","!")) and len(group)>=4:
                entries.append((cue["start"]+group[0]["start"],cue["start"]+word["start"]+word["duration"]+.12," ".join(w["text"] for w in group)))
                group=[]
        if group:entries.append((cue["start"]+group[0]["start"],cue["start"]+group[-1]["start"]+group[-1]["duration"]+.12," ".join(w["text"] for w in group)))
    entries.sort(key=lambda c:c[0])
    return entries


def timestamp(seconds,decimal="."):
    ms=round(max(0,seconds)*1000);hours,ms=divmod(ms,3600000);minutes,ms=divmod(ms,60000);secs,ms=divmod(ms,1000)
    return f"{hours:02}:{minutes:02}:{secs:02}{decimal}{ms:03}"


def write_subtitles(cues,output,start,end):
    srt=[];vtt=["WEBVTT",""]
    visible=[]
    for a,b,text in subtitle_cues(cues):
        if b<=start or a>=end:continue
        visible.append((max(0,a-start),min(end-start,b-start),text))
    for i,(a,b,text) in enumerate(visible):
        if i+1<len(visible):b=min(b,visible[i+1][0]-.02)
        # A plain two-line caption, not a moving word-by-word overlay.
        lines=[];line=""
        for word in text.split():
            if line and len(line)+len(word)+1>46:lines.append(line);line=word
            else:line=(line+" "+word).strip()
        if line:lines.append(line)
        text="\n".join(lines)
        srt +=[str(i+1),f"{timestamp(a,',')} --> {timestamp(b,',')}",text,""]
        vtt +=[f"{timestamp(a)} --> {timestamp(b)}",text,""]
    output.with_suffix(".srt").write_text("\n".join(srt),encoding="utf-8")
    output.with_suffix(".vtt").write_text("\n".join(vtt),encoding="utf-8")
    return output.with_suffix(".srt")


def embed_subtitles(video,srt):
    revised=video.with_name(video.stem+".captioned.mp4")
    subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),"-hide_banner","-loglevel","error","-y","-i",str(video),"-i",str(srt),"-map","0:v:0","-map","0:a:0?","-map","1:0","-c:v","copy","-c:a","copy","-c:s","mov_text","-metadata:s:s:0","language=eng","-metadata:s:s:0","title=English captions","-disposition:s:0","0","-movflags","+faststart",str(revised)],check=True)
    revised.replace(video)


def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--manifest",type=Path,default=ROOT/"docs/video/seminar-manifest.json")
    p.add_argument("--output",type=Path,default=ROOT.parent/"output/Benchlog_Seminar_Review.mp4")
    p.add_argument("--preview",help="Render a segment, e.g. 32:58, without touching original video")
    p.add_argument("--frames-only",action="store_true")
    p.add_argument("--fps",type=int,default=24)
    p.add_argument("--music-path",type=Path,help="Supplied licensed music excerpt; no generated score")
    args=p.parse_args();spec,scenes,cues,duration=timeline(args.manifest.resolve())
    folder=ROOT/"tmp/video/seminar";folder.mkdir(parents=True,exist_ok=True)
    (folder/"resolved-timeline.json").write_text(json.dumps({"scenes":scenes,"cues":cues,"duration":duration},indent=2),encoding="utf-8")
    for i,scene in enumerate(scenes):
        for j,fraction in enumerate([.25,.7]):frame_at(scene["start"]+scene["duration"]*fraction,scenes).save(folder/f"scene-{i+1}-{j}.jpg",quality=92)
    print(f"Timeline: {duration:.2f}s, {len(cues)} audio clips.",flush=True)
    if args.frames_only:return
    start,end=(0,duration) if not args.preview else tuple(map(float,args.preview.split(":")))
    if not 0<=start<end<=duration:raise ValueError("Preview range is outside timeline")
    music_path=args.music_path or ((args.manifest.parent/spec["music"]).resolve() if spec.get("music") else None)
    audio=mix_audio(cues,duration,folder,music_path)
    if args.preview and audio:
        trimmed=folder/"preview-audio.wav"
        subprocess.run([imageio_ffmpeg.get_ffmpeg_exe(),"-hide_banner","-loglevel","error","-y","-ss",str(start),"-i",str(audio),"-t",str(end-start),"-c:a","pcm_s16le",str(trimmed)],check=True)
        audio=trimmed
    args.output.parent.mkdir(parents=True,exist_ok=True)
    writer=imageio_ffmpeg.write_frames(str(args.output),(W,H),fps=args.fps,codec="libx264",quality=None,macro_block_size=16,audio_path=str(audio) if audio else None,audio_codec="aac" if audio else None,output_params=["-crf","21","-preset","fast","-movflags","+faststart","-t",str(end-start)],ffmpeg_log_level="warning")
    writer.send(None)
    try:
        total=round((end-start)*args.fps)
        for i in range(total):
            writer.send(frame_at(start+i/args.fps,scenes).tobytes())
            if i%(args.fps*10)==0:print(f"Rendered {i/args.fps:.0f}/{end-start:.0f}s",flush=True)
    finally:writer.close()
    srt=write_subtitles(cues,args.output,start,end)
    embed_subtitles(args.output,srt)
    print(f"Complete: {args.output} ({args.output.stat().st_size/1024**2:.1f}MB)",flush=True)


if __name__=="__main__":main()
