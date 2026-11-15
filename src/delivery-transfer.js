(function(root,factory){
  const api=factory(root.WIUDeliveryAssets||(typeof require==='function'?require('./delivery-assets'):null));
  if(typeof module==='object')module.exports=api;
  root.WIUTransfer=api;
})(globalThis,function(assets){
  'use strict';
  const encode=s=>new TextEncoder().encode(s);
  const base64=b=>{let s='';for(const x of b)s+=String.fromCharCode(x);return btoa(s);};
  // SHA-256 remains available in offline pages and clipboard-restricted remote desktops.
  // Prefer WebCrypto; the local SHA-256 below is a standards-based fallback.
  function shaFallback(bytes){
    const data=bytes instanceof Uint8Array?bytes:new Uint8Array(bytes);
    const H=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19],
      K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];
    const bitLength=data.length*8,length=Math.ceil((data.length+9)/64)*64,padded=new Uint8Array(length);
    padded.set(data);padded[data.length]=0x80;const view=new DataView(padded.buffer);view.setUint32(length-8,Math.floor(bitLength/2**32));view.setUint32(length-4,bitLength>>>0);
    const ro=(x,n)=>(x>>>n)|(x<<(32-n));
    for(let base=0;base<length;base+=64){const w=new Uint32Array(64);for(let i=0;i<16;i++)w[i]=view.getUint32(base+i*4);
      for(let i=16;i<64;i++){const a=w[i-15],b=w[i-2],s0=ro(a,7)^ro(a,18)^(a>>>3),s1=ro(b,17)^ro(b,19)^(b>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)>>>0;}
      let [a,b,c,d,e,f,g,h]=H;
      for(let i=0;i<64;i++){const S1=ro(e,6)^ro(e,11)^ro(e,25),ch=(e&f)^(~e&g),t1=(h+S1+ch+K[i]+w[i])>>>0,S0=ro(a,2)^ro(a,13)^ro(a,22),maj=(a&b)^(a&c)^(b&c),t2=(S0+maj)>>>0;
        h=g;g=f;f=e;e=(d+t1)>>>0;d=c;c=b;b=a;a=(t1+t2)>>>0;}
      const vals=[a,b,c,d,e,f,g,h];for(let i=0;i<8;i++)H[i]=(H[i]+vals[i])>>>0;
    }
    return H.map(v=>v.toString(16).padStart(8,'0')).join('');
  }
  const sha=async b=>{
    if(globalThis.crypto?.subtle?.digest)try{return Array.from(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256',b)),x=>x.toString(16).padStart(2,'0')).join('');}catch{}
    return shaFallback(b);
  };
  const quote=s=>"'"+s.replaceAll("'","'\"'\"'")+"'";
  async function prepare(files,target){
    if(!target.startsWith('/')||target.split('/').includes('..')||/[\x00-\x1f]/.test(target))throw Error('請填 Linux 已存在的絕對工作目錄，不可含 .. 或換行；接收器會拒絕 symlink。');
    const rows=[];
    for(const f of files){const bytes=encode(f.text);rows.push({path:f.path,bytes:bytes.length,sha256:await sha(bytes),data:base64(bytes)});}
    const payload=encode(JSON.stringify({format:'WrapItfUp-transfer-1',count:rows.length,files:rows}));
    // r94: use a compressed single manifest when the browser supports gzip.
    // Original file bytes/hashes remain available for the Linux receiver to check.
    let transferBytes=payload,encoding='plain';
    if(typeof CompressionStream==='function'){
      try{
        const compressed=new Uint8Array(await new Response(new Blob([payload]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
        if(compressed.length+64<payload.length){transferBytes=compressed;encoding='gzip';}
      }catch(_){} // Older/offline browsers keep the verified plain protocol.
    }
    const id=await sha(transferBytes),chunks=[],size=2048,total=Math.ceil(transferBytes.length/size);
    for(let offset=0;offset<transferBytes.length;offset+=size){const part=transferBytes.slice(offset,offset+size);chunks.push(JSON.stringify({package:id,index:chunks.length+1,total,sha256:await sha(part),data:base64(part)}));}
    if(chunks.some(line=>encode(line+'\n').length>3000))throw Error('Terminal transfer line exceeded 3000 UTF-8 bytes');
    // Only the fixed receiver program is executable; package text is read as JSON data.
    const encodedReceiver=assets.receiverZlib64||base64(encode(assets.receiver));
    const pieces=encodedReceiver.match(/.{1,1150}/g).map(x=>'\"'+x+'\"').join('\n');
    const bootstrap=assets.receiverZlib64?'import zlib,base64\nexec(zlib.decompress(base64.b64decode(\n'+pieces+'\n)))':'import base64\nexec(base64.b64decode(\n'+pieces+'\n))';
    if(('python3 -u -c '+quote(bootstrap)).split('\n').some(line=>encode(line+'\n').length>3000))throw Error('Bootstrap line too long');
    return {id,target,encoding,transferBytes:transferBytes.length,originalBytes:payload.length,files:rows.map(({path,bytes,sha256})=>({path,bytes,sha256})),chunks,command:'python3 -u -c '+quote(bootstrap)+' '+quote(target)+' '+quote(id)+' '+total,directory:target.replace(/\/$/,'')+'/wiu-'+id.slice(0,16)};
  }
  function receipt(transfer,text){
    const lines=String(text).split(/\r?\n/).map(s=>s.trim()),complete=lines.includes('COMPLETE: '+transfer.directory),hashes=lines.includes('Verified '+transfer.files.length+' files and all SHA-256 hashes.');
    const received=complete||lines.some(line=>{const m=/^RECEIVED (\d+)\/(\d+)(?: |$)/.exec(line);return m&&Number(m[1])===transfer.chunks.length&&Number(m[2])===transfer.chunks.length;});
    return {received,verified:complete&&hashes,generation:'unverified',compile:'unverified',simulation:'unverified'};
  }
  return {prepare,sha,shaFallback,receipt};
});
