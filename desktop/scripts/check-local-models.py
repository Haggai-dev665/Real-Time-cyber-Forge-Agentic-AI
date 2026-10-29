"""Exercise the real native installer bootstrap in isolated workspace caches.

No login, UI automation, credential changes or writes to the user's model cache.
Pass --executable when checking the debug build before packaging.
"""
from pathlib import Path
import argparse,hashlib,json,os,subprocess,tempfile,time
ROOT=Path(__file__).resolve().parents[2]

def main():
    parser=argparse.ArgumentParser();parser.add_argument('--executable',default=str(ROOT/'desktop/src-tauri/target/release/cyberforge-console.exe'));args=parser.parse_args()
    release=ROOT/'desktop/src-tauri/local-ml';manifest=json.loads((release/'manifest.json').read_text())
    expected=(release/'core-v1.json.gz').read_bytes();assert hashlib.sha256(expected).hexdigest()==manifest['sha256']
    cache=ROOT/'.cache';cache.mkdir(exist_ok=True)
    directory=Path(tempfile.mkdtemp(prefix='local-ml-check-',dir=cache))
    report={'model_revision':manifest['revision'],'sha256':manifest['sha256'],'bytes':manifest['bytes'],'cases':[]}
    def run(label,folder,offline=False,success=True):
        env=dict(os.environ,CYBERFORGE_LOCAL_MODEL_DIR=str(folder))
        if offline:env.update({k:'http://127.0.0.1:1' for k in ('HTTP_PROXY','HTTPS_PROXY','ALL_PROXY','http_proxy','https_proxy','all_proxy')});env.update(NO_PROXY='',no_proxy='')
        start=time.monotonic();p=subprocess.run([str(Path(args.executable).resolve()),'--prepare-local-ml'],env=env,capture_output=True,text=True,timeout=150,creationflags=subprocess.CREATE_NO_WINDOW if os.name=='nt' else 0)
        lines=[l for l in p.stdout.splitlines() if l.startswith('{')]
        assert lines,(label,p.returncode,p.stderr[-500:])
        r=json.loads(lines[-1]);assert r['ready'] is True,(label,r);assert r['success'] is success,(label,r)
        assert p.returncode==(0 if success else 1),(label,p.returncode)
        if success:
            data=(folder/manifest['sha256']/'core-v1.json.gz').read_bytes();assert hashlib.sha256(data).hexdigest()==manifest['sha256']
        result={'case':label,'seconds':round(time.monotonic()-start,3),'source':r['source'],'state':r['state'],'ready':r['ready'],'downloadedBytes':r.get('downloadedBytes'),'resumedFromBytes':r.get('resumedFromBytes',0)}
        report['cases'].append(result);print(json.dumps(result),flush=True);return r
    run('fresh public HF download',directory/'fresh')
    run('verified cache works with networking disabled',directory/'fresh',offline=True)
    part=directory/'resume'/manifest['sha256'];part.mkdir(parents=True)
    (part/'core-v1.json.gz.partial').write_bytes(expected[:65536])
    r=run('interrupted download resumes or restarts safely',directory/'resume')
    assert r.get('resumedFromBytes',0) in (0,65536)
    corrupt=directory/'fresh'/manifest['sha256']/'core-v1.json.gz';corrupt.write_bytes(b'corrupt cache')
    run('damaged existing cache is replaced on Windows',directory/'fresh')
    r=run('fresh offline install keeps verified bundled detectors',directory/'offline',offline=True,success=False)
    assert r['source']=='bundled-verified' and r['state']=='ready_offline'
    (directory/'receipt.json').write_text(json.dumps(report,indent=2)+'\n')
    print('PASS real native download, cache, resume, corruption recovery and offline fallback; receipt:',directory/'receipt.json')

if __name__=='__main__':main()
