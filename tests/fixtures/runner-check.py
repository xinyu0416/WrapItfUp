"""Exercise the public CLI with controlled simulator results, without a simulator dependency."""
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile

def read(path):
    return json.loads(path.read_text())

with tempfile.TemporaryDirectory() as temp:
    base = Path(temp)
    shutil.copyfile(sys.argv[1], base / 'run_wiu.py')
    spec = importlib.util.spec_from_file_location('runner', base / 'run_wiu.py')
    runner = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(runner)
    (base / 'delivery-config.json').write_text('{}')
    cfg = base / 'sample.output.cfg'
    for expr in ['clk >>> 1', 'clk <<< 2', '$clog2(8)', "8'h0f", "'1", '2_000', '{2{data[3:0]}}']:
        cfg.write_text('assign q = ' + expr + ';\n')
        runner.check_cfg(cfg)
    for invalid in ['x >>>', 'x >> >> 1', 'f(x)', 'x x']:
        cfg.write_text('assign q = ' + invalid + ';\n')
        try:
            runner.check_cfg(cfg)
        except RuntimeError:
            continue
        raise AssertionError('Unexpectedly accepted ' + invalid)

    (base / 'tb.v').write_text('module tb; endmodule\n')
    def generation(name, timestamp):
        run = base / 'runs' / ('run-' + name)
        output = run / 'output'
        output.mkdir(parents=True)
        for mode in ['asic', 'fpga']:
            for kind in ['normal', 'empty']:
                (output / (kind + '-' + mode + '.f')).write_text(('+define+FPGA\n' if mode == 'fpga' else '') + 'public.v\n')
        state = dict(generation='passed', generated_at_ns=timestamp, compilation='not_run', simulation='not_run',
                     output_sha256={f.name:runner.digest(f) for f in output.iterdir()})
        (run / 'status.json').write_text(json.dumps(state))
        return run
    older = generation('A', 100)
    newer = generation('B', 200)
    before = (older / 'status.json').read_bytes()
    binaries = base / 'tools'
    binaries.mkdir()
    (binaries / 'iverilog').write_text('#!/usr/bin/env python3\nfrom pathlib import Path\nimport sys\nPath(sys.argv[sys.argv.index("-o")+1]).write_bytes(b"fixture")\n')
    (binaries / 'vvp').write_text('#!/usr/bin/env python3\nimport os\nprint(os.environ["MOCK_RESULT"])\n')
    for f in binaries.iterdir(): f.chmod(0o755)
    def verify(kind, mode, message, success, selected=None):
        cmd = [sys.executable,'run_wiu.py','verify','--run',str(older if selected is None else selected),
               '--implementation',kind,'--device',mode,'--testbench','tb.v','--tb-top','tb','--simulator','iverilog']
        env = dict(os.environ, PATH=str(binaries)+os.pathsep+os.environ['PATH'], MOCK_RESULT=message)
        result = subprocess.run(cmd, cwd=base, env=env, text=True, capture_output=True)
        assert (result.returncode == 0) == success, (result.stdout,result.stderr)
        directory = older if selected is None else newer
        statuses = list((directory/'verification'/(kind+'-'+mode)).glob('attempt-*/status.json'))
        latest = max(statuses, key=lambda f:read(f)['started_at_ns'])
        state = read(latest)
        assert [state['implementation'],state['device'],state['compilation'],state['simulation']] == [kind,mode,'passed','passed' if success else 'failed']
        assert state['testbench_sha256'] == hashlib.sha256((base/'tb.v').read_bytes()).hexdigest()
        assert (latest.parent/'verify-simulate.log').read_text().strip()==message
        return latest
    evidence = [verify(kind,mode,'TB_RESULT PASS',True) for kind in ['normal','empty'] for mode in ['asic','fpga']]
    failure = verify('normal','asic','TB_RESULT PASSIVE',False)
    retry = verify('normal','asic','TB_RESULT PASS',True)
    assert len(set(evidence+[failure,retry])) == 6
    assert read(failure)['simulation']=='failed' and all(read(p)['simulation']=='passed' for p in evidence)
    assert (older/'status.json').read_bytes()==before and runner.latest_run()==newer
    verify('empty','fpga','TB_RESULT PASS',True,'latest')
