"""Disposable socket-only PostgreSQL fixture; never connects to production.
Run with python3; optionally set PG_TEST_BIN to a local PostgreSQL bin directory.
"""
from pathlib import Path
import json, os, subprocess, tempfile, time
ROOT=Path(__file__).resolve().parents[1]
BIN=Path(os.environ.get('PG_TEST_BIN','/opt/homebrew/opt/postgresql@17/bin'))
with tempfile.TemporaryDirectory(prefix='m365-owner-',dir='/tmp') as scratch:
    env={k:v for k,v in os.environ.items() if not k.startswith('PG')}
    env.update(PGHOST=scratch,PGPORT='55448',PGDATABASE='postgres')
    def run(name,args=[],data=None,check=True):
        return subprocess.run([str(BIN/name),*args],input=data,env=env,text=True,capture_output=True,check=check,timeout=20)
    def sql(s,check=True): return run('psql',['-X','-At','-v','ON_ERROR_STOP=1'],s,check)
    started=False
    try:
        run('initdb',['-D',scratch+'/data','-A','trust','--no-locale'])
        run('pg_ctl',['-D',scratch+'/data','-l',scratch+'/log','-o',f"-c listen_addresses='' -k {scratch} -p 55448",'start']);started=True
        fixture=(ROOT/'tests/mission365-crm-role-state.sql').read_text().split('insert into auth.users')[0]
        for line in fixture.splitlines():
            if line.startswith('\\ir '):fixture=fixture.replace(line,(ROOT/'tests'/line[4:]).resolve().read_text())
        sql(fixture+'\ncommit;')
        a='00000000-0000-0000-0000-000000000001';b='00000000-0000-0000-0000-000000000002'
        sql(f"""create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
        grant usage on schema auth to authenticated;
        grant select,insert,update,delete on mission365_user_roles to authenticated;
        alter table mission365_user_roles enable row level security;
        create policy mission365_user_roles_own on mission365_user_roles for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
        insert into auth.users values('{a}'),('{b}');
        insert into mission365_user_roles values('{a}','volunteer','active');""")
        before=sql('select count(*) from mission365_crm_outbox').stdout.strip()
        denied=sql(f"set role authenticated; set request.jwt.claim.sub='{a}'; update mission365_user_roles set user_id='{b}' where user_id='{a}';",False)
        assert denied.returncode!=0 and 'row-level security policy' in denied.stderr,denied.stderr
        assert sql(f"select count(*) from mission365_user_roles where user_id='{a}'").stdout.strip()=='1'
        assert sql('select count(*) from mission365_crm_outbox').stdout.strip()==before
        hidden=sql(f"set role authenticated; set request.jwt.claim.sub='{b}'; update mission365_user_roles set status='inactive' where user_id='{a}' returning role;")
        assert 'UPDATE 0' in hidden.stdout,hidden.stdout
        # Trusted owner bypasses RLS; user_id-only mutation must reconcile both users.
        sql(f"update mission365_user_roles set user_id='{b}' where user_id='{a}';")
        stages=json.loads(sql("select json_object_agg(user_id,onboarding_stage) from mission365_crm_links").stdout)
        assert stages[a]=='account_created' and stages[b]=='role_activated',stages
        assert int(sql('select count(*) from mission365_crm_outbox').stdout.strip())==int(before)+2
        assert sql("select count(*) from mission365_crm_outbox where payload->>'operation'='TRANSFER' and payload->>'direction'='out' and payload->'status'='null'::jsonb").stdout.strip()=='1'
        assert sql("select count(*) from mission365_crm_outbox where payload->>'operation'='TRANSFER' and payload->>'direction'='in' and payload->>'status'='active'").stdout.strip()=='1'
        # Retain activation when the old user still has another active role;
        # a simultaneous inactive transfer must not activate its recipient.
        sql(f"insert into mission365_user_roles values('{b}','vendor','active'); update mission365_user_roles set user_id='{a}',status='inactive' where user_id='{b}' and role='volunteer';")
        stages=json.loads(sql("select json_object_agg(user_id,onboarding_stage) from mission365_crm_links").stdout)
        assert stages[a]=='account_created' and stages[b]=='role_activated',stages
        # Two distinct roles move in opposite directions in overlapping sessions.
        sql(f"update mission365_user_roles set status='active' where user_id='{a}';")
        count=int(sql('select count(*) from mission365_crm_outbox').stdout.strip())
        children=[]
        try:
            def launch(name,statement):
                p=subprocess.Popen([str(BIN/'psql'),'-X','-At','-v','ON_ERROR_STOP=1','-c',f"set application_name='{name}';set statement_timeout='8s';"+statement],env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE);children.append(p);return p
            def wait(name,predicate):
                deadline=time.monotonic()+3
                while time.monotonic()<deadline:
                    if sql(f"select count(*) from pg_stat_activity where application_name='{name}' and {predicate}").stdout.strip()=='1':return
                    time.sleep(.03)
                raise AssertionError('Expected overlap not observed')
            first=launch('transfer_first',f"begin;update mission365_user_roles set user_id='{b}' where user_id='{a}' and role='volunteer';select pg_sleep(3);commit;")
            wait('transfer_first',"wait_event='PgSleep'")
            second=launch('transfer_second',f"begin;update mission365_user_roles set user_id='{a}' where user_id='{b}' and role='vendor';commit;")
            wait('transfer_second',"wait_event_type='Lock'")
            for child in children:
                out,err=child.communicate(timeout=12)
                assert child.returncode==0 and 'WARNING' not in err,err
        finally:
            for child in children:
                if child.poll() is None:child.terminate();child.communicate(timeout=5)
        stages=json.loads(sql("select json_object_agg(user_id,onboarding_stage) from mission365_crm_links").stdout)
        assert stages[a]==stages[b]=='role_activated',stages
        assert int(sql('select count(*) from mission365_crm_outbox').stdout.strip())==count+4
        assert sql("select count(*) from mission365_crm_outbox where status<>'pending' or attempts<>0 or processed_at is not null").stdout.strip()=='0'
        print(json.dumps({'database':sql('show server_version').stdout.strip(),'authenticated_transfer_denied':True,'other_user_update_zero_rows':True,'both_user_reconciliation':True,'transfer_payloads':True,'remaining_active_role_preserved':True,'inactive_transfer_not_activation':True,'opposite_transfer_lock_wait_verified':True,'opposite_transfer_events':4,'production_mutations':0},indent=2))
    finally:
        if started:run('pg_ctl',['-D',scratch+'/data','-m','fast','stop'])
