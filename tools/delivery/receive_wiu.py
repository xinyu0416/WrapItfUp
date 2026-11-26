"""Paste-only receiver. Payload records are JSON data, never shell/Python code."""
import base64, hashlib, json, os, re, sys, tempfile, zlib
from pathlib import Path

def sha(data): return hashlib.sha256(data).hexdigest()

def main():
    target, package, total = Path(sys.argv[1]), sys.argv[2], int(sys.argv[3])
    if not target.is_absolute() or '..' in target.parts:
        raise ValueError('Destination must be an absolute directory without ..')
    if not re.fullmatch('[0-9a-f]{64}', package) or not 1 <= total <= 100000:
        raise ValueError('Invalid package identity/count')
    for parent in [target] + list(target.parents):
        if parent.is_symlink(): raise ValueError('Destination may not traverse symlinks')
    target.mkdir(parents=True, exist_ok=True)
    if not target.is_dir(): raise ValueError('Destination is not a directory')
    stage = target / ('.wiu-receive-' + package)
    if stage.is_symlink(): raise ValueError('Unsafe receive directory')
    stage.mkdir(mode=0o700, exist_ok=True)
    if not stage.is_dir(): raise ValueError('Receive path is not a directory')
    def chunks(): return sorted(int(p.name) for p in stage.iterdir() if p.name.isdigit())
    def progress():
        have = set(chunks())
        missing = [str(n) for n in range(1, total + 1) if n not in have]
        print('RECEIVED %s/%s package=%s (%.0f%%)%s' % (len(have), total, package, 100.0*len(have)/total, '' if not missing else ' - waiting for more'), flush=True)
    print('Linux receiver ready. Paste the copied batch, then CHECK after the last batch.', flush=True)
    progress()
    for line in sys.stdin:
        try:
            if len(line.encode('utf-8')) > 3000: raise ValueError('Complete line exceeds 3000 bytes')
            line = line.strip()
            if not line: continue
            if line == 'QUIT': return
            if line != 'CHECK':
                row = json.loads(line)
                if row['package'] != package or row['total'] != total: raise ValueError('Wrong package/count')
                n = row['index']
                if type(n) is not int or not 1 <= n <= total: raise ValueError('Invalid segment number')
                data = base64.b64decode(row['data'], validate=True)
                if len(data) > 4096 or sha(data) != row['sha256']: raise ValueError('Segment SHA-256 mismatch; paste this segment again')
                path = stage / str(n)
                if path.is_symlink(): raise ValueError('Unsafe segment file')
                if path.exists():
                    if path.read_bytes() == data:
                        print('DUPLICATE segment %s: already received, identical; kept the original' % n, flush=True)
                        progress(); continue
                    raise ValueError('Conflicting duplicate segment %s; existing verified segment kept' % n)
                # Atomic replacement is limited to staging records for this exact package.
                fd, tmp = tempfile.mkstemp(dir=stage)
                with os.fdopen(fd, 'wb') as out: out.write(data)
                os.replace(tmp, path)
                if n == total or n % 5 == 0: progress()
                continue
            if chunks() != list(range(1, total + 1)):
                missing=[str(i) for i in range(1,total+1) if i not in set(chunks())]
                raise ValueError('Missing segments: ' + ', '.join(missing))
            raw = b''
            for n in range(1, total + 1):
                p = stage / str(n)
                if p.is_symlink(): raise ValueError('Unsafe segment file')
                raw += p.read_bytes()
            if sha(raw) != package: raise ValueError('Package SHA-256 mismatch; re-paste damaged segments')
            if raw[:2] == b'\x1f\x8b':
                inflate=zlib.decompressobj(31)
                expanded=inflate.decompress(raw, 32*1024*1024+1)
                if len(expanded)>32*1024*1024 or not inflate.eof or inflate.unconsumed_tail:
                    raise ValueError('Compressed payload invalid or exceeds 32 MB')
                raw=expanded
            payload = json.loads(raw)
            files = payload['files']
            if payload['count'] != len(files) or not files: raise ValueError('File count mismatch')
            names, decoded = set(), []
            for row in files:
                name = row['path']; p = Path(name)
                if not name or p.is_absolute() or '..' in p.parts or '\\' in name or any(ord(c) < 32 for c in name) or name != p.as_posix() or p.parts[0].startswith('.wiu-'):
                    raise ValueError('Unsafe filename: ' + repr(name))
                if name.casefold() in names: raise ValueError('Duplicate filename: ' + name)
                names.add(name.casefold())
                data = base64.b64decode(row['data'], validate=True)
                if len(data) != row['bytes'] or sha(data) != row['sha256']: raise ValueError('File length/SHA-256 mismatch: ' + name)
                decoded.append((p, data))
            # Check file/directory collisions before creating any delivered file.
            for p, _ in decoded:
                if any(parent.as_posix().casefold() in names for parent in p.parents if parent != Path('.')):
                    raise ValueError('File/directory collision: ' + str(p))
            final = target / ('wiu-' + package[:16])
            if final.exists() or final.is_symlink(): raise ValueError('Destination already exists; nothing overwritten: ' + str(final))
            print('Verified %s files and all SHA-256 hashes.' % len(decoded), flush=True)
            # Reserve final name exclusively, and build privately before publication.
            lock = target / ('.wiu-lock-' + package[:16])
            fd = os.open(lock, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600); os.close(fd)
            build = Path(tempfile.mkdtemp(prefix='.wiu-build-', dir=target))
            try:
                for p, data in decoded:
                    dest = build / p; dest.parent.mkdir(parents=True, exist_ok=True)
                    with dest.open('xb') as out: out.write(data)
                # mkdir is an exclusive reservation; do not replace any old destination.
                final.mkdir()
                for child in build.iterdir(): child.rename(final / child.name)
                build.rmdir()
            finally: lock.unlink()
            print('COMPLETE: %s' % final, flush=True)
            print('Linux files received and verified; gen_top/compile/simulation NOT RUN.', flush=True)
            print('Next: cd %s && python3 run_wiu.py diagnose && python3 run_wiu.py generate' % final, flush=True)
            return
        except Exception as exc:
            print('REJECTED: %s. No existing delivery files overwritten. Correct/re-paste and retry CHECK.' % exc, flush=True)
    print('Interrupted. Run the same receiver command to resume.', flush=True)

if __name__ == '__main__':
    try: main()
    except Exception as exc:
        print('RECEIVER FAILED: ' + str(exc), file=sys.stderr); sys.exit(1)
