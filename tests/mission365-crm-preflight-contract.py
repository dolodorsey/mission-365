"""Disposable socket-only PostgreSQL fixture; never connects to production.
Run with python3; optionally set PG_TEST_BIN to a local PostgreSQL bin directory.
"""
from pathlib import Path
import json, os, subprocess, tempfile, time
ROOT=Path(__file__).resolve().parents[1]
BIN=Path(os.environ.get('PG_TEST_BIN','/opt/homebrew/opt/postgresql@17/bin'))
with tempfile.TemporaryDirectory(prefix='m365-contract-',dir='/tmp') as scratch:
    env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
    env.update(PGHOST=scratch,PGPORT='55449',PGDATABASE='postgres')
    def run(name,args=[],data=None,check=True):
        return subprocess.run([str(BIN/name),*args],input=data,env=env,text=True,capture_output=True,check=check,timeout=20)
    def sql(s,check=True): return run('psql',['-X','-At','-v','ON_ERROR_STOP=1'],s,check)
    started=False
    try:
        run('initdb',['-D',scratch+'/data','-A','trust','--no-locale'])
        run('pg_ctl',['-D',scratch+'/data','-l',scratch+'/log','-o',f"-c listen_addresses='' -k {scratch} -p 55449",'start']);started=True
        fixture=(ROOT/'tests/mission365-crm-role-state.sql').read_text().split('insert into auth.users')[0]
        for line in fixture.splitlines():
            if line.startswith('\\ir '):fixture=fixture.replace(line,(ROOT/'tests'/line[4:]).resolve().read_text())
        sql(fixture+'\ncommit;')
        a='00000000-0000-0000-0000-000000000001';b='00000000-0000-0000-0000-000000000002'
        sql(f"insert into auth.users values('{a}'),('{b}');insert into mission365_user_roles values('{a}','volunteer','active'),('{a}','vendor','active');")
        sql(f"update mission365_user_roles set user_id='{b}' where role='volunteer';delete from mission365_user_roles where user_id='{a}' and role='vendor';")
        snapshot=json.loads(sql("""select json_build_object(
          'project_id','rwpcqeiukrektpjqkpdx','observed_at',clock_timestamp(),
          'events',(select json_agg(to_jsonb(o)||jsonb_build_object(
            'link',(select to_jsonb(l) from mission365_crm_links l where l.user_id=o.user_id),
            'roles',(select coalesce(jsonb_agg(to_jsonb(r)),'[]'::jsonb) from mission365_user_roles r where r.user_id=o.user_id),
            'applications','[]'::jsonb)) from mission365_crm_outbox o))""").stdout)
        incoming=Path(scratch)/'snapshot.json';outgoing=Path(scratch)/'result.json'
        incoming.write_text(json.dumps(snapshot))
        subprocess.run(['node',str(ROOT/'scripts/crm/preflight.mjs'),str(incoming),str(outgoing)],check=True,capture_output=True,text=True,timeout=10)
        results=json.loads(outgoing.read_text())
        expected={'external_consumer_ownership_unverified','enrollment_effects_unverified','person_classification_unverified'}
        assert len(results)==7,results # 2 signup, 2 inserts, 2 transfer halves, 1 deletion
        for event,result in zip(snapshot['events'],results):
            assert set(result['holds'])==expected,result
            assert result['derived_stage']==('account_created' if event['user_id']==a else 'role_activated'),result
            assert result['write_authorized'] is False and result['mark_processed'] is False and result['external_actions']==0
        contracts=[r['event_contract'] for r in results]
        assert contracts.count('role_transfer_reconciliation')==2 and contracts.count('role_deletion_reconciliation')==1
        assert sql("select count(*) from mission365_crm_outbox where status<>'pending' or attempts<>0 or processed_at is not null").stdout.strip()=='0'
        print(json.dumps({'database':sql('show server_version').stdout.strip(),'actual_producer_events_checked':len(results),'transfer_halves':2,'deletion':1,'all_operational_holds_retained':True,'historical_active_payloads_do_not_reactivate':True,'production_mutations':0},indent=2))
    finally:
        if started:run('pg_ctl',['-D',scratch+'/data','-m','fast','stop'])
