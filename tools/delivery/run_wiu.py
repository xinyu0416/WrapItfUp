#!/usr/bin/env python3
"""WrapItfUp delivery runner (__WRAPITFUP_RELEASE__). Python 3 standard library only.
Company gen_top and gen_empty remain external dependencies.
"""
import argparse, hashlib, json, os, re, shutil, subprocess, sys, tempfile, time
from pathlib import Path

BASE = Path(__file__).resolve().parent
STEP = 'configuration'
RUN = None
ATTEMPT = None
STATE = {'generation': 'not_run', 'compilation': 'not_run', 'simulation': 'not_run'}

def digest(p):
    return hashlib.sha256(p.read_bytes()).hexdigest()

def write_state():
    if RUN:
        directory = ATTEMPT or RUN
        target = directory / 'status.json'
        pending = directory / 'status.tmp'
        pending.write_text(json.dumps(STATE, indent=2) + '\n')
        pending.replace(target)

def require_file(p):
    p = Path(p)
    if not p.is_file() or not os.access(p, os.R_OK):
        raise RuntimeError('Missing or unreadable file: %s. Restore it or correct delivery-config.json.' % p)
    return p

def absolute(value):
    p = Path(value)
    return p if p.is_absolute() else BASE / p

def executable(value):
    found = str(absolute(value)) if '/' in value else shutil.which(value)
    if not found or not Path(found).is_file() or not os.access(found, os.X_OK):
        raise RuntimeError('Executable not found: %r. Put only the executable name/path here; place arguments in its Args array. Check PATH and permissions; this is not an output.cfg error.' % value)
    return found

def argv(value, label):
    if not isinstance(value, list) or not all(isinstance(x, str) and '\x00' not in x and '\n' not in x for x in value):
        raise RuntimeError(label + ' must be a JSON array of individual arguments.')
    return value

def module_check(p, name):
    text = require_file(p).read_text()
    text = re.sub(r'/\*.*?\*/|//[^\n]*', '', text, flags=re.S)
    if not re.search(r'\bmodule\s+(?:automatic\s+)?' + re.escape(name) + r'(?=\s|[;#(])', text):
        raise RuntimeError('Module name mismatch in %s: expected %s. Reimport the matching source or correct the configured path.' % (p, name))
    return text

def check_cfg(p):
    """Validate the exported assignment/expression subset before company tools.
    This is syntax checking, not an RTL compiler or functional proof.
    """
    text = re.sub(r'/\*.*?\*/|//[^\n]*', '', p.read_text(), flags=re.S).strip()
    if not text: return
    if not text.endswith(';'): raise RuntimeError('cfg syntax: missing semicolon in ' + str(p))
    token = re.compile(r"\s*((?:\d[\d_]*)?'[sS]?[bBoOdDhH][0-9a-fA-F_xXzZ?]+|'[01xXzZ]|\d[\d_]*|\$clog2\b|[A-Za-z_][A-Za-z0-9_$]*|===|!==|<<<|>>>|<<|>>|<=|>=|==|!=|&&|\|\||[~!+*/%&|^?:(){}\[\],<>-])")
    precedence = {'||':1,'&&':2,'|':3,'^':4,'&':5,'==':6,'!=':6,'===':6,'!==':6,'<':7,'>':7,'<=':7,'>=':7,'<<<':8,'>>>':8,'<<':8,'>>':8,'+':9,'-':9,'*':10,'/':10,'%':10}
    for statement in text.split(';')[:-1]:
        m = re.fullmatch(r'\s*assign\s+[A-Za-z_][A-Za-z0-9_$]*\s*=\s*(.*?)\s*', statement, re.S)
        if not m: raise RuntimeError('cfg syntax: expected assign OUTPUT = expression; in ' + str(p))
        expr, tokens, pos = m[1], [], 0
        while pos < len(expr):
            match = token.match(expr, pos)
            if not match: raise RuntimeError('cfg syntax: invalid token near %r in %s' % (expr[pos:pos+20], p))
            tokens.append(match[1]); pos = match.end()
        cursor = 0
        def peek(): return tokens[cursor] if cursor < len(tokens) else ''
        def take(expected=None):
            nonlocal cursor
            v = peek()
            if not v or expected is not None and v != expected: raise ValueError('expected ' + (expected or 'expression'))
            cursor += 1
            return v
        def expression(minimum=0):
            v = take()
            if v in ['~','!','+','-','&','|','^']: expression(11)
            elif v == '$clog2':
                take('('); expression(); take(')')
            elif v == '(':
                expression(); take(')')
            elif v == '{':
                expression()
                if peek() == '{':
                    take('{'); expression()
                    while peek() == ',': take(','); expression()
                    take('}')
                else:
                    while peek() == ',': take(','); expression()
                take('}')
            elif not re.match(r"[A-Za-z_0-9']", v): raise ValueError('expected value, got ' + v)
            while peek() == '[':
                take('['); expression()
                if peek() == ':': take(':'); expression()
                take(']')
            while peek() in precedence and precedence[peek()] >= minimum:
                op = take(); expression(precedence[op]+1)
            if minimum == 0 and peek() == '?':
                take('?'); expression(); take(':'); expression()
        try:
            expression()
            if cursor != len(tokens): raise ValueError('unexpected ' + peek())
        except ValueError as exc:
            raise RuntimeError('cfg syntax: %s in %s; expression %r. Correct this assignment and rerun.' % (exc, p, expr))

def command(args, cwd, label):
    global STEP
    STEP = label
    log = (ATTEMPT or RUN) / (label + '.log')
    print('[%s] %s' % (label, json.dumps(args)), flush=True)
    with log.open('w') as stream:
        r = subprocess.run(args, cwd=cwd, stdout=stream, stderr=subprocess.STDOUT)
    if r.returncode:
        tail = log.read_text(errors='replace')[-2500:]
        raise RuntimeError('Command exited %s. Log: %s\n%s\nNext: inspect this log and the command above; fix the reported input/tool, then run again.' % (r.returncode, log, tail))
    severity = re.compile(r'^\s*(?:(?:\*\*|\*{3})\s*)?(?:ERROR|FATAL)(?=$|[\s:.\[\-])|^\s*(?:[1-9]\d*\s+errors?\b|Traceback \(most recent call last\):)', re.I)
    for number, line in enumerate(log.read_text(errors='replace').splitlines(), 1):
        if severity.search(line):
            raise RuntimeError('Tool reported ERROR/FATAL despite returning 0. Log: %s line %s: %s' % (log, number, line))
    return log

def safe_relative(value):
    p = Path(value)
    if not value or p.is_absolute() or '..' in p.parts or '\\' in value:
        raise RuntimeError('Unsafe package path: ' + str(value))
    return p

def generate(cfg):
    global STEP, RUN
    STEP = 'preflight'
    top = cfg['top']
    if not re.fullmatch(r'[A-Za-z_][A-Za-z0-9_$]*', top):
        raise RuntimeError('Invalid Top name: ' + top)
    c = cfg['config']
    gt, py = executable(c['genTop']), executable(c['python'])
    ga, pa = argv(c.get('genTopArgs', []), 'genTopArgs'), argv(c.get('pythonArgs', []), 'pythonArgs')
    empty = require_file(absolute(c['genEmpty']))
    defines = [require_file(absolute(cfg[k])) for k in ['asicDefine', 'fpgaDefine']]
    source = require_file(BASE / (top + '.v.org'))
    override = BASE / (top + '.output.cfg')
    if not override.is_file():
        raise RuntimeError('Missing %s. The company Empty tool would default ALL outputs to zero. Restore the cfg; to deliberately use all-zero defaults, create an empty cfg and rerun.' % override)
    check_cfg(override)
    inputs = [source, override, empty] + defines
    for s in cfg['sources']:
        p = require_file(absolute(s['path'] or s['target']))
        module_check(p, s['module'])
        inputs.append(p)
    for name in cfg['inputs']:
        inputs.append(require_file(BASE / safe_relative(name)))
    runs = BASE / 'runs'
    if runs.is_symlink():
        raise RuntimeError('runs must not be a symlink. Choose a fresh extracted package directory.')
    runs.mkdir(exist_ok=True)
    RUN = Path(tempfile.mkdtemp(prefix=time.strftime('run-%Y%m%d-%H%M%S-'), dir=runs))
    STATE.update(generation='running', input_sha256={str(p): digest(p) for p in inputs}, run=str(RUN))
    write_state()
    combined = {}
    for mode in ['fpga', 'asic']:
        work = RUN / mode
        work.mkdir()
        for name in cfg['inputs']:
            target = work / safe_relative(name)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.copyfile(BASE / name, target)
        for s in cfg['sources']:
            target = work / s['target']
            if s['path']:
                if target.exists(): target.unlink()
                target.symlink_to(absolute(s['path']).resolve())
        normal = work / (top + '.v')
        normal.write_bytes(source.read_bytes())
        flags = ['-I', str(defines[0])]
        if mode == 'fpga': flags += ['-I', str(defines[1])]
        before = (normal.stat().st_ino, normal.stat().st_mtime_ns, normal.stat().st_size)
        command([gt] + ga + ['--no_header', normal.name] + flags + ['--ext', '.v,.vp,.vcs.vp'], work, mode + '-gen_top')
        diagnostics = list(work.glob('*.ctrl.*'))
        if diagnostics:
            raise RuntimeError('gen_top diagnostics: %s. Correct the org/source using these files; this run is not usable.' % ', '.join(map(str, diagnostics)))
        module_check(normal, top)
        if (normal.stat().st_ino, normal.stat().st_mtime_ns, normal.stat().st_size) == before:
            raise RuntimeError('gen_top returned success but did not write a fresh output: %s. Check that the correct company generator ran.' % normal)
        stub = work / (top + '.empty.v')
        if stub.exists(): stub.unlink()
        command([py] + pa + [str(empty), normal.name, '1'], work, mode + '-gen_empty')
        module_check(stub, top)
        combined[mode] = [normal.read_text(), stub.read_text()]
    STEP = 'publish-generation'
    pending = RUN / 'output.pending'
    pending.mkdir()
    for p in inputs:
        if digest(p) != STATE['input_sha256'][str(p)]:
            raise RuntimeError('Input changed during generation: %s. Restore a consistent source revision and rerun.' % p)
    # Publish matching source/define snapshots with the generated Top so external
    # source links cannot later make compilation use different RTL silently.
    for name in cfg['inputs']:
        if name.endswith(('.v.org', '.output.cfg')): continue
        dest = pending / safe_relative(name)
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(RUN / 'asic' / name, dest)
    for index, mode in enumerate(['asic', 'fpga']):
        shutil.copyfile(defines[index], pending / (top + '_' + mode + '_define.v'))
    for index, suffix in enumerate(['.v', '.empty.v']):
        (pending / (top + suffix)).write_text('`ifdef FPGA\n' + combined['fpga'][index].rstrip() + '\n`else\n' + combined['asic'][index].rstrip() + '\n`endif //FPGA\n')
    pending.rename(RUN / 'output')
    output_filelists(RUN / 'output', top)
    STATE.update(generation='passed', generated_at_ns=time.time_ns(), output_sha256={p.relative_to(RUN / 'output').as_posix(): digest(p) for p in (RUN / 'output').rglob('*') if p.is_file()})
    write_state()
    print('GENERATION PASSED: %s\nCompilation: NOT RUN. Functional simulation: NOT RUN.\nUse exactly one of normal / .empty.v from this output directory.' % (RUN / 'output'))

def output_filelists(output, top):
    for kind in ('normal', 'empty'):
        for mode in ('asic', 'fpga'):
            name = kind+'-'+mode+'.f'
            base = require_file(BASE / name).read_text().splitlines()
            if ('+define+FPGA' in base) != (mode == 'fpga'):
                raise RuntimeError('FPGA branch mismatch in '+name)
            lines = []
            for item in base:
                if not item.strip(): continue
                if item.startswith('+incdir+'):
                    lines.append('+incdir+'+str((output/item[8:]).resolve()))
                elif item.startswith('+'): lines.append(item)
                else:
                    path=output/safe_relative(item)
                    if not path.is_file(): raise RuntimeError('Generated filelist missing '+str(path))
                    lines.append(str(path.resolve()))
            chosen=top+('.v' if kind=='normal' else '.empty.v')
            other=top+('.empty.v' if kind=='normal' else '.v')
            if sum(Path(x).name==chosen for x in lines)!=1 or any(Path(x).name==other for x in lines):
                raise RuntimeError('Normal and Empty mixed in '+name)
            (output/name).write_text('\n'.join(lines)+'\n')

def latest_run():
    runs=BASE/'runs'
    if not runs.exists(): raise RuntimeError('No generated runs')
    hits=[]
    for p in runs.glob('run-*'):
        try:
            if not p.is_symlink() and (p/'output').is_dir() and json.loads((p/'status.json').read_text())['generation']=='passed': hits.append(p)
        except (OSError, ValueError, KeyError): pass
    if not hits: raise RuntimeError('No successful generated run')
    def generation_order(path):
        record = json.loads((path / 'status.json').read_text())
        return record.get('generated_at_ns', (path / 'output').stat().st_mtime_ns), path.name
    return max(hits, key=generation_order)

def start_verification(folder, kind, mode):
    global RUN, ATTEMPT, STATE, STEP
    folder = Path(folder)
    if folder.is_symlink() or folder.resolve().parent != (BASE / 'runs').resolve():
        raise RuntimeError('Invalid run directory')
    generation = json.loads(require_file(folder / 'status.json').read_text())
    if generation.get('generation') != 'passed':
        raise RuntimeError('Generation not passed')
    RUN = folder.resolve()
    directory = RUN / 'verification' / (kind + '-' + mode)
    directory.mkdir(parents=True, exist_ok=True)
    ATTEMPT = Path(tempfile.mkdtemp(prefix='attempt-', dir=directory))
    STEP = 'verification-preflight'
    STATE = {'run': str(RUN), 'implementation': kind, 'device': mode,
             'generation': 'passed', 'output_sha256': generation['output_sha256'],
             'compilation': 'not_run', 'simulation': 'not_run', 'started_at_ns': time.time_ns()}
    write_state()
    print('Verification record: ' + str(ATTEMPT / 'status.json'), flush=True)

def has_pass_marker(log, marker):
    return any(line.strip() == marker.strip() for line in log.read_text(errors='replace').splitlines())


def verify_simple(cfg, folder, kind, mode, tb, tb_top, sim, marker):
    start_verification(folder, kind, mode)
    for name, expected in STATE['output_sha256'].items():
        if digest(require_file(RUN/'output'/safe_relative(name))) != expected:
            STATE['generation'] = 'invalidated'
            raise RuntimeError('Generated source changed: ' + name)
    filelist=require_file(RUN/'output'/(kind+'-'+mode+'.f'))
    lines=filelist.read_text().splitlines()
    if ('+define+FPGA' in lines)!=(mode=='fpga'): raise RuntimeError('Wrong FPGA branch')
    tbfile=require_file(absolute(tb))
    if not tb_top:
        modules=re.findall(r'\bmodule\s+([A-Za-z_][A-Za-z_0-9]*)\b',tbfile.read_text(errors='replace'))
        if len(modules)!=1: raise RuntimeError('Provide --tb-top')
        tb_top=modules[0]
    if not marker.strip() or '\n' in marker: raise RuntimeError('Missing testbench pass marker')
    STATE.update(testbench=str(tbfile), testbench_sha256=digest(tbfile), tb_top=tb_top,
                 simulator=sim, pass_marker=marker)
    work=ATTEMPT; artifact=work/'simv'
    STATE.update(compilation='running',simulation='not_run'); write_state()
    try:
        if sim=='vcs':
            compile=[executable('vcs'),'-full64','-sverilog','-f',str(filelist),str(tbfile),'-top',tb_top,'-o',str(artifact)]
            execute=[str(artifact)]
        else:
            compile=[executable('iverilog'),'-g2012','-f',str(filelist),'-s',tb_top,'-o',str(artifact),str(tbfile)]
            execute=[executable('vvp'),str(artifact)]
        command(compile,work,'verify-compile')
        if not artifact.is_file() or not artifact.stat().st_size: raise RuntimeError('No new compiler artifact')
        STATE.update(compilation='passed',simulation='running');write_state()
        logfile=command(execute,work,'verify-simulate')
        if not has_pass_marker(logfile, marker): raise RuntimeError('Testbench PASS marker missing')
        STATE.update(simulation='passed');write_state()
        print('VERIFICATION PASSED '+kind+'/'+mode)
    except Exception:
        if STATE.get('compilation')=='running': STATE['compilation']='failed'
        if STATE.get('simulation')=='running': STATE['simulation']='failed'
        write_state();raise

def verify(cfg, directory):
    start_verification(directory, 'configured', 'custom')
    for name, expected in STATE['output_sha256'].items():
        if digest(require_file(RUN / 'output' / safe_relative(name))) != expected:
            STATE.update(generation='invalidated', compilation='not_run', simulation='not_run')
            raise RuntimeError('Generated RTL changed. Regenerate before verification: ' + name)
    v = cfg.get('verification', {})
    compile_cmd, sim_cmd = argv(v.get('compile', []), 'compile'), argv(v.get('simulate', []), 'simulate')
    marker, artifact = v.get('passMarker', ''), v.get('compileArtifact', '')
    if not compile_cmd or not sim_cmd or not isinstance(marker,str) or not marker.strip() or not artifact:
        raise RuntimeError('Set verification.compile / simulate argument arrays, compileArtifact and passMarker in delivery-config.json. Commands run in a fresh verify directory; WIU_RTL_DIR points to the selected generated RTL. Compile normal OR Empty, never both.')
    work = ATTEMPT
    os.environ['WIU_RTL_DIR'] = str(RUN / 'output')
    os.environ['WIU_PACKAGE_DIR'] = str(BASE)
    STATE.update(compilation='running', simulation='not_run', verification_directory=str(work))
    write_state()
    command([executable(compile_cmd[0])] + compile_cmd[1:], work, work.name + '-compile')
    product = require_file(work / safe_relative(artifact))
    if product.stat().st_size == 0: raise RuntimeError('Compiler produced an empty artifact: ' + str(product))
    STATE.update(compilation='passed', simulation='running'); write_state()
    # ./simv is resolved against this new compile directory, not the package.
    sim_tool = str(work / sim_cmd[0]) if sim_cmd[0].startswith('./') else executable(sim_cmd[0])
    log = command([sim_tool] + sim_cmd[1:], work, work.name + '-simulate')
    if not has_pass_marker(log, marker):
        raise RuntimeError('Simulation exited zero without the configured testbench PASS marker. Inspect ' + str(log))
    STATE['simulation'] = 'passed'; write_state()
    print('COMPILATION PASSED; FUNCTIONAL SIMULATION PASSED for the configured testbench/marker only. Status: ' + str(ATTEMPT / 'status.json'))

def main():
    global STEP
    parser = argparse.ArgumentParser()
    parser.add_argument('action', choices=['generate', 'verify', 'diagnose'])
    parser.add_argument('--run')
    parser.add_argument('--implementation', choices=['normal','empty'],default='normal')
    parser.add_argument('--device',choices=['asic','fpga'],default='asic')
    parser.add_argument('--testbench')
    parser.add_argument('--tb-top')
    parser.add_argument('--simulator',choices=['vcs','iverilog'],default='vcs')
    parser.add_argument('--pass-marker',default='TB_RESULT PASS')
    parser.add_argument('--worker', action='store_true', help=argparse.SUPPRESS)
    parser.add_argument('--environment-ready', action='store_true', help=argparse.SUPPRESS)
    args = parser.parse_args()
    cfg = json.loads(require_file(BASE / 'delivery-config.json').read_text())
    launch = argv(cfg.get('launcher', []), 'launcher')
    if launch and not args.worker:
        # Use a blocking Grid launcher for a final result. A submit-only launcher
        # can only report submission; completion is in the worker status.json.
        r = subprocess.run([executable(launch[0])] + launch[1:] + [sys.executable, str(Path(__file__).resolve())] + sys.argv[1:] + ['--worker'])
        print('LAUNCHER RETURNED %s. This is not a generation/compile/simulation pass; inspect the worker log and runs/*/status.json.' % r.returncode)
        return r.returncode
    setup = cfg.get('environmentScript', '')
    if setup and not args.environment_ready:
        setup = require_file(absolute(setup))
        return subprocess.call(['/bin/bash', '-c', 'source "$1" || exit; shift; exec "$@"', 'wiu-environment', str(setup), sys.executable, str(Path(__file__).resolve())] + sys.argv[1:] + ['--environment-ready'])
    if args.action == 'diagnose':
        print(json.dumps({'python3': sys.executable, 'cwd': str(BASE), 'PATH': os.environ.get('PATH', ''), 'environmentScript': setup, 'launcher': launch, 'genTop': executable(cfg['config']['genTop']), 'pythonForEmpty': executable(cfg['config']['python'])}, indent=2, default=str))
    elif args.action == 'generate': generate(cfg)
    elif args.action=='verify':
        folder=latest_run() if not args.run or args.run=='latest' else Path(args.run)
        if args.testbench: verify_simple(cfg,folder,args.implementation,args.device,args.testbench,args.tb_top,args.simulator,args.pass_marker)
        else: verify(cfg,folder)
    return 0

if __name__ == '__main__':
    try: sys.exit(main())
    except Exception as exc:
        for key in ['generation', 'compilation', 'simulation']:
            if STATE.get(key) == 'running': STATE[key] = 'failed'
        STATE.update(failed_step=STEP, error=str(exc)); write_state()
        print('FAILED [%s]: %s' % (STEP, exc), file=sys.stderr)
        if ATTEMPT: print('Verification record: ' + str(ATTEMPT / 'status.json'), file=sys.stderr)
        elif RUN: print('Failed run (do not compile intermediate RTL): ' + str(RUN), file=sys.stderr)
        sys.exit(1)
