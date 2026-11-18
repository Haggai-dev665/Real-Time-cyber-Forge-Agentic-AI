"""Export trusted, pinned sklearn detectors to non-executable native tree data.

Build-time only: Python/sklearn/pickle never ship to desktop users. --publish
uploads only the derived pack to the existing model repo, then pins its immutable
revision and SHA-256 in the desktop release manifest. --parity emits independent
sklearn predictions and feature vectors for the native scorer's regression test.
"""
from pathlib import Path
import argparse,concurrent.futures,getpass,gzip,hashlib,json,os,sys,urllib.request
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'.cache/local-ml-tools'))
sys.path.insert(0,str(ROOT/'ml-services/hf_space_deploy'))
from url_features import extract_url_features,set_popular_domains,feature_row,rescale_score
import joblib,numpy as np

REPO='Che237/cyberforge-models'
REV='298f585f6e9f869636cc491dcde22f108d9b51b6'
NAMES=['phishing_detection','malware_detection','web_attack_detection','anomaly_detection']
CACHE=ROOT/'.cache/local-ml-source'
OUT=ROOT/'desktop/src-tauri/local-ml'

def get(path):
    dest=CACHE/path;dest.parent.mkdir(parents=True,exist_ok=True)
    if not dest.exists():dest.write_bytes(urllib.request.urlopen(f'https://huggingface.co/{REPO}/resolve/{REV}/{path}',timeout=120).read())
    return dest

def c(n):
    if n<=1:return 0.
    if n==2:return 1.
    return 2*(np.log(n-1)+np.euler_gamma)-2*(n-1)/n

def publish(data,manifest):
    from hf_env import get_hf_token
    # HF's client performs the preupload/LFS handshake for .gz model artifacts;
    # sending binary data as a regular NDJSON commit can be refused by the Hub.
    os.environ.setdefault('HF_HOME',str(ROOT/'.cache/hf-publish'))
    from huggingface_hub import HfApi
    receipt=HfApi(token=get_hf_token()).upload_file(path_or_fileobj=data,path_in_repo='desktop/core-v1.json.gz',repo_id=REPO,repo_type='model',commit_message='Publish native desktop detector pack (pinned sklearn export)')
    manifest['revision']=receipt.oid
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print('Published model pack at revision',manifest['revision'])

def main():
    p=argparse.ArgumentParser();p.add_argument('--publish',action='store_true');p.add_argument('--publish-only',action='store_true');p.add_argument('--token-stdin',action='store_true');args=p.parse_args()
    if args.token_stdin:os.environ['HF_TOKEN']=getpass.getpass('Hugging Face publishing token (not echoed): ').strip()
    if args.publish_only:
        data=(OUT/'core-v1.json.gz').read_bytes();manifest=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
        assert hashlib.sha256(data).hexdigest()==manifest['sha256']
        publish(data,manifest);return
    paths=[f'{n}/{f}' for n in NAMES for f in ('best_model.pkl','metadata.json')]+['reputation/popular_domains.txt']
    with concurrent.futures.ThreadPoolExecutor(max_workers=5) as pool:list(pool.map(get,paths))
    popular=get('reputation/popular_domains.txt').read_text(encoding='utf-8').splitlines();set_popular_domains(popular)
    pack={'schema':1,'source_repo':REPO,'source_revision':REV,'feature_revision':hashlib.sha256((ROOT/'ml-services/hf_space_deploy/url_features.py').read_bytes()).hexdigest(),'popular_domains':popular,'models':[]}
    loaded={};metas={}
    for name in NAMES:
        model=joblib.load(get(name+'/best_model.pkl'));meta=json.loads(get(name+'/metadata.json').read_text(encoding='utf-8'))
        assert meta.get('uses_scaler') is False
        loaded[name]=model;metas[name]=meta
        base={'name':name,'features':meta['feature_names'],'threshold':meta.get('decision_threshold') or .5,'trees':[]}
        if type(model).__name__=='HistGradientBoostingClassifier':
            assert len(model.classes_)==2 and model.classes_.tolist()==[0,1]
            base.update(kind='hist_gradient_boosting',bias=float(model._baseline_prediction[0,0]))
            for stage in model._predictors:
                assert len(stage)==1
                nodes=stage[0].nodes
                assert not any(nodes['is_categorical'])
                base['trees'].append([[int(n['feature_idx']),float(n['num_threshold']),int(n['left']),int(n['right']),float(n['value']),bool(n['is_leaf']),bool(n['missing_go_to_left'])] for n in nodes])
        elif type(model).__name__=='IsolationForest':
            base.update(kind='isolation_forest',bias=float(model.offset_),normalizer=float(c(model.max_samples_)))
            for estimator,features in zip(model.estimators_,model.estimators_features_):
                t=estimator.tree_
                base['trees'].append([[int(features[max(0,int(t.feature[i]))]),float(t.threshold[i]),int(t.children_left[i]),int(t.children_right[i]),float(c(t.n_node_samples[i])),bool(t.children_left[i]==-1),False] for i in range(t.node_count)])
        else:raise ValueError('Unsupported trusted model '+type(model).__name__)
        pack['models'].append(base)
    OUT.mkdir(parents=True,exist_ok=True)
    data=gzip.compress(json.dumps(pack,separators=(',',':'),allow_nan=False).encode(),mtime=0);artifact=OUT/'core-v1.json.gz';artifact.write_bytes(data)
    urls=['https://google.com/','https://github.com/login','https://example.com/path?a=b','http://192.168.1.1:8080/a.exe','https://paypal-security-login.verify-account.xyz/login?password=foo','https://x.github.io/login','https://www.wikipedia.org/wiki/Security','https://example.com/search?q=%27+OR+1%3D1--','https://example.com/?x=%3Cscript%3Ealert(1)%3C/script%3E','https://example.com/a/../b;param?x=a=b&y=3#ignore','https://[2001:db8::1]:443/a','https://EXAMPLE.COM:443/a','https://example.com/%2527?q=%00+%22','https://example.com/a//b?q=javascript:alert(1)','https://bit.ly/a','https://xn--pple-43d.com/verify','https://example.com/?q=$(id)%7Ctest','https://example.com/?q=/*hello*/;--','https://example.com/?q=document.cookie','https://example.com/?q=order+by+name','https://example.com/?q=%FF']
    # 250 deterministic, varied URLs provide a wider precision/split-boundary check.
    urls += [f'https://{("a"*(i%23+1))}{i}.{"com" if i%2 else "top"}/path_{i}/file.{["html","exe","js","zip"][i%4]}?q={i}%20login&next=https%3A%2F%2Fexample.com' for i in range(250)]
    fixtures=[]
    for url in urls:
        f=extract_url_features(url);pred={}
        for n,m in loaded.items():
            x=np.array([feature_row(f,metas[n]['feature_names'])],dtype=np.float32)
            if n=='anomaly_detection':pred[n]=float(m.decision_function(x)[0])
            else:
                prob=float(m.predict_proba(x)[0,1]);threshold=metas[n].get('decision_threshold',.5)
                pred[n]=rescale_score(prob,threshold) if .5<threshold<1 else prob
        fixtures.append({'url':url,'features':f,'predictions':pred})
    (OUT/'parity.json').write_text(json.dumps(fixtures,separators=(',',':')),encoding='utf-8')
    manifest={'schema':1,'repo':REPO,'revision':None,'path':'desktop/core-v1.json.gz','sha256':hashlib.sha256(data).hexdigest(),'bytes':len(data),'sourceRevision':REV,'models':NAMES}
    if (OUT/'manifest.json').exists():
        old=json.loads((OUT/'manifest.json').read_text(encoding='utf-8'))
        if old.get('sha256')==manifest['sha256']:manifest['revision']=old.get('revision')
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    if args.publish:
        publish(data,manifest)
    (OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'artifact':str(artifact),'bytes':len(data),'models':len(NAMES),'parity_urls':len(fixtures),'published_revision':manifest['revision'],'sha256':manifest['sha256']}))

if __name__=='__main__':main()
