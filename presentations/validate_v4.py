"""Check the revised thesis/deck against saved evidence and layout contracts."""
from pathlib import Path
from zipfile import ZipFile
import hashlib,json,posixpath,subprocess,sys
sys.path.insert(0,str(Path(__file__).parent/'.vendor'))
from lxml import etree as E
from PIL import Image
from pptx import Presentation

HERE=Path(__file__).resolve().parent;ROOT=HERE.parent
W='http://schemas.openxmlformats.org/wordprocessingml/2006/main'
P='http://schemas.openxmlformats.org/presentationml/2006/main'
NS={'w':W,'p':P}

def package(path):
    with ZipFile(path) as z:
        assert z.testzip() is None,path
        names=set(z.namelist())
        for name in names:
            if not name.endswith(('.xml','.rels')):continue
            root=E.fromstring(z.read(name))
            if name.endswith('.rels'):
                base=posixpath.dirname(posixpath.dirname(name))
                for rel in root:
                    if rel.get('TargetMode')=='External':continue
                    target=rel.get('Target')
                    target=(target.lstrip('/') if target.startswith('/') else posixpath.normpath(posixpath.join(base,target)))
                    assert target in names,(path,name,target)

def text(e):return ''.join(e.itertext('{'+W+'}t'))
def table_rows(e):return [[text(tc) for tc in tr.findall('w:tc',NS)] for tr in e.findall('w:tr',NS)]

def main():
    doc=ROOT/'Che Haggai Ngha Kang.docx';deck=HERE/'CyberForge - Thesis Defence v4.pptx';backup=HERE/'Che Haggai Ngha Kang - Before V4 update.docx'
    for p in (doc,deck,backup):package(p)
    with ZipFile(backup) as z:before=E.fromstring(z.read('word/document.xml'))
    with ZipFile(doc) as z:
        after=E.fromstring(z.read('word/document.xml'));full=text(after)
        geom=lambda tree:[{E.QName(c).localname:dict(c.attrib) for c in s if E.QName(c).localname in ('pgSz','pgMar','pgNumType','cols','titlePg')} for s in tree.findall('.//w:sectPr',NS)]
        assert geom(before)==geom(after),'Section geometry or page numbering changed'
        oldbody=before.find('w:body',NS)
        newtables=[table_rows(t) for t in after.findall('.//w:tbl',NS)]
        for i in (514,517,529,532,544,555,565):assert table_rows(oldbody[i]) in newtables,('Historical table altered',i)
        assert after.find('.//{http://schemas.openxmlformats.org/officeDocument/2006/math}oMath') is not None
        for phrase in ('3.7.5 Qwen training','3.7.9 Release evaluation','4.10 Qwen fine-tuning','4.11 Current desktop','4.12 Validity','2,462','273','84/87','96.55%','130','LoRA','Q4_K_M','2026-10-23.3','Table 3.3','Figure 4.15'):
            assert phrase in full,phrase
        assert 'Error! Reference source not found' not in full
        captions=[]
        for p in after.findall('.//w:body/w:p',NS):
            st=p.find('w:pPr/w:pStyle',NS)
            if st is not None and st.get('{'+W+'}val') in ('ImageCaption','TableCaption'):captions.append(text(p))
        assert sum(t.startswith('Figure 3.') for t in captions)==6
        assert sum(t.startswith('Figure 4.') for t in captions)==15
        assert sum(t.startswith('Table 4.') for t in captions)==12
    prs=Presentation(deck)
    expected=['CyberForge','Brief introduction','Problem statement','Research questions','Research objectives','Brief literature review']+['Methods and materials used']*3+['Results']*2+['Conclusion']
    assert len(prs.slides)==12
    builds=0
    for i,(slide,heading) in enumerate(zip(prs.slides,expected),1):
        texts=[s.text for s in slide.shapes if s.has_text_frame]
        assert heading in texts or i==1,(i,heading)
        assert not any('/ 15' in t for t in texts)
        assert 'Source:' in slide.notes_slide.notes_text_frame.text
        ids={str(s.shape_id) for s in slide.shapes}
        timings=slide._element.findall('.//p:cTn',NS);tids=[n.get('id') for n in timings]
        assert len(tids)==len(set(tids)),i
        assert slide._element.find('p:transition',NS) is not None,i
        for target in slide._element.findall('.//p:spTgt',NS):assert target.get('spid') in ids
        builds+=len(slide._element.findall('.//p:animEffect',NS))
    for box in json.loads((HERE/'layout-audit-v4.json').read_text(encoding='utf8')):
        assert box['x']>=0 and box['y']>=0 and box['x']+box['w']<=16.01 and box['y']+box['h']<=9.01,box
    for name in ('orbit.gif','signal.gif'):
        im=Image.open(HERE/'assets'/name);assert im.n_frames>=40 and im.info.get('loop')==0
    diagram_checks=json.loads((HERE/'diagrams-v4/skill-checks.json').read_text())
    assert len(diagram_checks)==8 and all(r['passed'] for r in diagram_checks)
    report={'slides':12,'guideOrder':'passed','nativeEntranceEffects':builds,'diagrams':8,'diagramSkillChecks':'8/8 passed','packageRelationships':'valid','sectionGeometryAndPageNumbering':'preserved','historicalTablesPreserved':7,'newFigureCaptions':4,'notes':12,'thesisSha256':hashlib.sha256(doc.read_bytes()).hexdigest(),'deckSha256':hashlib.sha256(deck.read_bytes()).hexdigest(),'backupSha256':hashlib.sha256(backup.read_bytes()).hexdigest()}
    native=HERE/'office-validation-v4.json'
    if native.exists():
        native_report=json.loads(native.read_text(encoding='utf-8-sig'))
        assert native_report['presentation']['slides']==12
        assert all(s['animationEffects']>0 for s in native_report['presentation']['details'])
        assert all(not s['textOverflows'] for s in native_report['presentation']['details']),native_report['presentation']['details']
        report['nativeOffice']=native_report
    else:report['nativeOffice']='not yet recorded'
    (HERE/'validation-v4.json').write_text(json.dumps(report,indent=2),encoding='utf8')
    revision=json.loads((HERE/'thesis-v4-revision-log.json').read_text(encoding='utf8'))
    revision['final_output_sha256']=report['thesisSha256'];revision['native_office_refreshed']=native.exists()
    (HERE/'thesis-v4-revision-log.json').write_text(json.dumps(revision,ensure_ascii=False,indent=2),encoding='utf8')
    print(json.dumps({k:v for k,v in report.items() if k!='nativeOffice'},indent=2))

if __name__=='__main__':main()
