"""Validate V5's package, evidence text, guide and exact V3 effect/font retention."""
from pathlib import Path
from zipfile import ZipFile
import hashlib
import json
import posixpath
import sys

HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE/'.vendor'))
from lxml import etree as E
from PIL import Image,ImageDraw,ImageFont
from pptx import Presentation
import pymupdf
from build_defence_v5 import KEEP,NS,sha


def main():
    deck=HERE/'CyberForge - Thesis Defence v5.pptx'
    source=HERE/'CyberForge - Thesis Defence v3.pptx'
    with ZipFile(deck) as z,ZipFile(source) as before:
        assert z.testzip() is None
        names=set(z.namelist())
        for name in names:
            if not name.endswith(('.xml','.rels')):continue
            root=E.fromstring(z.read(name))
            if name.endswith('.rels'):
                base=posixpath.dirname(posixpath.dirname(name))
                for rel in root:
                    if rel.get('TargetMode')=='External':continue
                    t=rel.get('Target')
                    target=t.lstrip('/') if t.startswith('/') else posixpath.normpath(posixpath.join(base,t))
                    assert target in names,(name,target)
        fontparts=[n for n in names if n.startswith('ppt/fonts/')]
        assert len(fontparts)==6
        for n in fontparts:assert z.read(n)==before.read(n),n
        for n in KEEP:
            path=f'ppt/slides/slide{n}.xml'
            b=E.fromstring(before.read(path));a=E.fromstring(z.read(path))
            assert E.tostring(b.find('p:timing',NS),method='c14n')==E.tostring(a.find('p:timing',NS),method='c14n'),n
            assert len(a.findall('.//p:cTn[@presetClass]',NS))>0
        assert len([n for n in names if n.startswith('ppt/slides/slide') and n.endswith('.xml')])==15
    prs=Presentation(deck)
    assert len(prs.slides)==15
    assert prs.slide_width==20*914400 and prs.slide_height==11.25*914400
    text=[];fonts=set();notes=[];headings=[]
    def walk(shapes):
        for s in shapes:
            if s.has_text_frame:
                text.append(s.text)
                for p in s.text_frame.paragraphs:
                    for r in p.runs:
                        if r.font.name:fonts.add(r.font.name)
            if s.shape_type==6:walk(s.shapes)
    for s in prs.slides:
        walk(s.shapes)
        notes.append(s.notes_slide.notes_text_frame.text)
        headings.append(next((sh.text for sh in s.shapes if sh.name.startswith('Kicker')),'TITLE / THANK YOU'))
    full='\n'.join(text);allnotes='\n'.join(notes)
    assert fonts=={'Oswald','Titillium Web'},fonts
    for phrase in ('BRIEF INTRODUCTION','PROBLEM STATEMENT','RESEARCH QUESTIONS','RESEARCH OBJECTIVES','BRIEF LITERATURE REVIEW','METHODS AND MATERIALS USED','RESULTS','CONCLUSION'):
        assert phrase in full,phrase
    for phrase in ('QWEN FINE-TUNING','2,462','273','487','LoRA','100 L4 steps','0.1367','0.0665','412.67 s','130/130','84/87','95.40%','96.55%','43.08%','GBNF','NATIVE ACCEPTANCE','V2_RELEASE.md'):
        assert phrase in full,phrase
    for phrase in ('5,417','678','0.00002','2026-10-23.3','494483e9a85362b5d0bd596f9040bbc0848c860a','14.906','20.298','Both','240'):
        assert phrase.lower() in allnotes.lower(),phrase
    for bad in ('Used, not fine-tuned','9.5 / 10','99.9%','medium risk for everything'):
        assert bad not in full,bad
    office=json.loads((HERE/'office-validation-v5.json').read_text(encoding='utf-8-sig'))
    assert office['slides']==15
    assert all(not s['textOverflows'] for s in office['details'])
    assert all(s['transition']==3954 for s in office['details'])
    effects=sum(s['animationEffects'] for s in office['details'])
    pdf=HERE/'CyberForge - Thesis Defence v5 - Preview.pdf'
    with pymupdf.open(pdf) as p:
        assert len(p)==15
    # Contact sheet from actual native Office renders, not a recreated template.
    cellw,cellh=600,360
    sheet=Image.new('RGB',(cellw*3,cellh*5),(20,20,22))
    draw=ImageDraw.Draw(sheet)
    for i in range(15):
        path=HERE/'previews-v5-native'/f'slide-{i+1:02}.png'
        with Image.open(path) as im:
            assert im.size==(1600,900)
            im=im.convert('RGB').resize((580,326),Image.Resampling.LANCZOS)
        x=(i%3)*cellw+10;y=(i//3)*cellh+6
        sheet.paste(im,(x,y));draw.text((x,y+331),f'{i+1:02}',fill='#C1FF72')
    sheet.save(HERE/'Slide overview v5.png')
    report={'slides':15,'font_families':sorted(fonts),'unchanged_embedded_font_files':6,
            'exact_v3_animation_and_run_properties':True,'morph_transitions':15,
            'native_animation_effects':effects,'native_text_overflows':0,'pdf_pages':15,
            'guide':headings,'pptx_sha256':sha(deck.read_bytes()),'v3_sha256':sha(source.read_bytes()),
            'evidence':'ml-services/llm_finetune/V2_RELEASE.md; TRAINING_STATUS.md; saved release checks',
            'fine_tuning':'completed prior L4 LoRA job; no new training run represented',
            'factual_score_scope':'reviewed-passage constrained output, under the same policy for both adapters'}
    (HERE/'validation-v5.json').write_text(json.dumps(report,indent=2),encoding='utf-8')
    print(json.dumps(report,indent=2))


if __name__=='__main__':main()
