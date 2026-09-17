"""Run with python3; requires local PostgreSQL binaries, never a deployed database.

Creates a private disposable cluster with Unix-socket-only access. Each race
verifies the second session actually waits for the first session's link lock.
"""
from pathlib import Path
import json
import os
import shutil
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
TOOLS = {name: shutil.which(name) for name in ('initdb', 'pg_ctl', 'psql')}
if not all(TOOLS.values()):
    raise SystemExit('Local initdb, pg_ctl and psql are required')

def main():
    with tempfile.TemporaryDirectory(prefix='m365-crm-', dir='/tmp') as scratch:
        path = Path(scratch)
        env = {k: v for k, v in os.environ.items() if not k.startswith('PG')}
        env.update(PGHOST=scratch, PGPORT='55449', PGDATABASE='postgres')
        started = False
        children = []

        def run(args, **kwargs):
            return subprocess.run(args, env=env, check=True, text=True,
                                  capture_output=True, timeout=20, **kwargs)

        def sql(statement):
            return run([TOOLS['psql'], '-X', '-At', '-v', 'ON_ERROR_STOP=1'],
                       input=statement).stdout.strip()

        def wait_for(name, condition):
            deadline = time.monotonic() + 2
            while time.monotonic() < deadline:
                if sql(f"select count(*) from pg_stat_activity where application_name='{name}' and {condition};") == '1':
                    return
                time.sleep(0.03)
            raise AssertionError(f'{name}: expected database wait was not observed')

        def session(name, statement):
            child = subprocess.Popen(
                [TOOLS['psql'], '-X', '-At', '-v', 'ON_ERROR_STOP=1', '-c',
                 f"set application_name='{name}'; set statement_timeout='8s'; " + statement],
                env=env, text=True, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            children.append(child)
            return child

        try:
            run([TOOLS['initdb'], '-D', str(path / 'data'), '-A', 'trust', '--no-locale', '--encoding=UTF8'])
            run([TOOLS['pg_ctl'], '-D', str(path / 'data'), '-l', str(path / 'server.log'),
                 '-o', f"-c listen_addresses='' -k {scratch} -p 55449", 'start'])
            started = True
            # Reuse the exact minimal schema and migration fixture, committing only
            # in this newly created local cluster so separate sessions can see it.
            fixture = (ROOT / 'tests/mission365-crm-role-state.sql').read_text().split('insert into auth.users')[0]
            for line in fixture.splitlines():
                if line.startswith('\\ir '):
                    source = (ROOT / 'tests' / line[4:]).resolve()
                    fixture = fixture.replace(line, source.read_text())
            sql(fixture + '\ncommit;')
            uid = '00000000-0000-0000-0000-000000000001'
            sql(f"insert into auth.users values('{uid}'); insert into mission365_user_roles values('{uid}','mission_owner','active'),('{uid}','volunteer','active');")
            results = []
            for label, initial_volunteer, final_volunteer, expected in [
                ('simultaneous last-role deactivation', 'active', 'inactive', 'account_created'),
                ('deactivation with simultaneous activation', 'inactive', 'active', 'role_activated'),
            ]:
                sql(f"update mission365_user_roles set status=case when role='mission_owner' then 'active' else '{initial_volunteer}' end;")
                before = int(sql("select count(*) from mission365_crm_outbox where event_type='role.changed';"))
                first = session('m365_first', "begin; update mission365_user_roles set status='inactive' where role='mission_owner'; select pg_sleep(3); commit;")
                wait_for('m365_first', "wait_event='PgSleep'")
                second = session('m365_second', f"begin; update mission365_user_roles set status='{final_volunteer}' where role='volunteer'; commit;")
                wait_for('m365_second', "wait_event_type='Lock'")
                for child in (first, second):
                    out, err = child.communicate(timeout=10)
                    assert child.returncode == 0, err
                    assert 'WARNING' not in err, err
                actual = sql(f"select onboarding_stage from mission365_crm_links where user_id='{uid}';")
                assert actual == expected, (label, actual, expected)
                after = int(sql("select count(*) from mission365_crm_outbox where event_type='role.changed';"))
                assert after - before == 2, (label, 'missing or duplicate queue events')
                assert sql("select count(*) from mission365_crm_outbox where status<>'pending' or attempts<>0 or processed_at is not null;") == '0'
                results.append({'scenario': label, 'overlap_verified': True, 'stage': actual, 'new_pending_events': 2})
            print(json.dumps({'passed': results, 'database': sql('show server_version;')}, indent=2))
        finally:
            for child in children:
                if child.poll() is None:
                    child.terminate()
                    child.communicate(timeout=5)
            if started:
                run([TOOLS['pg_ctl'], '-D', str(path / 'data'), '-m', 'fast', 'stop'])

if __name__ == '__main__':
    main()
