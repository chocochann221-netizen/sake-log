"""Exercise captured owner policies and the proposed migration in isolated PG17.
No production connection, credentials, rows or published TCP ports are used.
"""
import json, os, subprocess, time, uuid
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
IMAGE='postgres:17-alpine@sha256:266d3c257594e195b309ae9d1805e54c788f1d7b375f56bf6c367aac6c917e7b'
ENV=dict(os.environ)
for key in ['DOCKER_HOST','DOCKER_CONTEXT','DOCKER_TLS','DOCKER_TLS_VERIFY','DOCKER_CERT_PATH']:ENV.pop(key,None)
NAME='sake-photo-ownership-'+uuid.uuid4().hex[:10]
A='11111111-1111-4111-8111-111111111111';B='22222222-2222-4222-8222-222222222222'
RA='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';RB='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
PA='cccccccc-cccc-4ccc-8ccc-cccccccccccc';PB='dddddddd-dddd-4ddd-8ddd-dddddddddddd'
results=[]
def docker(*args,**kw):return subprocess.run(['docker','--host=unix:///var/run/docker.sock',*args],env=ENV,text=True,capture_output=True,**kw)
def sql(text):return docker('exec','-i',NAME,'psql','-X','-U','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=sqlstate',input=text)
def run_as(user,query):return sql("BEGIN; SET LOCAL ROLE authenticated; SELECT set_config('request.jwt.claim.sub', '"+user+"', true);\n"+query+"\nROLLBACK;")
def insert(user,record,path):return f"INSERT INTO public.sake_photos VALUES ('{uuid.uuid4()}','{user}',{('NULL' if record is None else chr(39)+record+chr(39))},'{path}','front');"
def check(name,result,blocked=False):
 passed=result.returncode!=0 and '42501' in result.stderr if blocked else result.returncode==0
 results.append({'check':name,'pass':passed});print(json.dumps(results[-1]),flush=True)
 if not passed:print(result.stderr[:300],flush=True)
try:
 start=docker('run','--rm','-d','--network','none','--memory','256m','--name',NAME,'-e','POSTGRES_HOST_AUTH_METHOD=trust',IMAGE)
 if start.returncode:raise RuntimeError(start.stderr[:200])
 for attempt in range(40):
  if docker('exec',NAME,'pg_isready','-U','postgres').returncode==0:break
  time.sleep(.25)
 else:raise RuntimeError('Local PostgreSQL did not become ready')
 initial=sql((ROOT/'tests/fixtures/photo-ownership-before.sql').read_text()+f"\nINSERT INTO public.drinking_records VALUES ('{RA}','{A}','A fixture'),('{RB}','{B}','B fixture');\nINSERT INTO public.sake_photos VALUES ('{PA}','{A}','{RA}','{A}/original.png','front'),('{PB}','{B}','{RB}','{B}/original.png','front');")
 if initial.returncode:raise RuntimeError(initial.stderr)
 for who,own,other,photo in [(A,RA,RB,PA),(B,RB,RA,PB)]:
  foreign=B if who==A else A
  check('baseline_reproduces_foreign_record_'+who[:1],run_as(who,insert(who,other,who+'/probe.png')))
  check('baseline_reproduces_foreign_path_'+who[:1],run_as(who,insert(who,own,foreign+'/probe.png')))
  check('baseline_reproduces_foreign_path_update_'+who[:1],run_as(who,f"UPDATE public.sake_photos SET storage_path='{foreign}/probe.png' WHERE id='{photo}';"))
 migration=sql((ROOT/'supabase/migrations/20261026090000_sake_photo_reference_ownership.sql').read_text())
 if migration.returncode:raise RuntimeError(migration.stderr)
 for who,own,other,photo in [(A,RA,RB,PA),(B,RB,RA,PB)]:
  foreign=B if who==A else A
  check('own_insert_'+who[:1],run_as(who,insert(who,own,who+'/valid.png')))
  check('nullable_record_preserved_'+who[:1],run_as(who,insert(who,None,who+'/unattached.png')))
  check('foreign_record_rejected_'+who[:1],run_as(who,insert(who,other,who+'/probe.png')),True)
  check('foreign_path_rejected_'+who[:1],run_as(who,insert(who,own,foreign+'/probe.png')),True)
  check('foreign_record_update_rejected_'+who[:1],run_as(who,f"UPDATE public.sake_photos SET drinking_record_id='{other}' WHERE id='{photo}';"),True)
  check('foreign_path_update_rejected_'+who[:1],run_as(who,f"UPDATE public.sake_photos SET storage_path='{foreign}/probe.png' WHERE id='{photo}';"),True)
  check('own_update_'+who[:1],run_as(who,f"UPDATE public.sake_photos SET storage_path='{who}/updated.png' WHERE id='{photo}';"))
  check('foreign_rows_invisible_'+who[:1],run_as(who,f"DO $$ BEGIN IF EXISTS (SELECT 1 FROM public.sake_photos WHERE user_id='{foreign}') THEN RAISE EXCEPTION 'cross-user read'; END IF; END $$;"))
  check('own_delete_'+who[:1],run_as(who,f"DELETE FROM public.sake_photos WHERE id='{photo}';"))
 for suffix in ['../x','./x','%2e%2e/x','a//x','a/','a?x','a#x','a'+chr(92)+'x']:
  check('reject_path_'+repr(suffix),run_as(A,insert(A,RA,A+'/'+suffix)),True)
 count=sql('SELECT count(*) FROM pg_policies WHERE tablename=\'sake_photos\' AND permissive=\'RESTRICTIVE\';')
 check('restrictive_policies_created',count)
 if '2' not in count.stdout:raise RuntimeError('Expected two restrictive policies')
finally:
 docker('rm','-f',NAME)
print(json.dumps({'passed':sum(x['pass'] for x in results),'failed':sum(not x['pass'] for x in results),'scope':'isolated PostgreSQL; not live A/B UAT'}))
raise SystemExit(1 if any(not x['pass'] for x in results) else 0)
