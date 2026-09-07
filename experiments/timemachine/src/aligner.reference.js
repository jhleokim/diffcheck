/* 조항 정렬 엔진 — 순서 보존 전역 정렬(Needleman-Wunsch)
   탐욕법과 달리 한 번의 오매칭이 연쇄되지 않는다. */
/* 유사도 — 문자 n-gram을 쓴다.
   어절 토큰은 한국어 조사 때문에 무너진다: `관할법원` ↔ `관할법원의 특례` 가 0.000이 나온다.
   형태소 분석기 없이 n-gram으로 우회한다. 제목은 길이 비대칭(본문 415자 vs 특약 82자)에
   강하도록 코사인 대신 포함도를 쓴다. */
function ngrams(s,n){ s=(s||"").replace(/\s+/g,""); const m=new Map();
  for(let i=0;i+n<=s.length;i++){const g=s.slice(i,i+n); m.set(g,(m.get(g)||0)+1);} return m; }
function cos(a,b){ let d=0,na=0,nb=0;
  for(const v of a.values()) na+=v*v;
  for(const [k,v] of b){ nb+=v*v; const x=a.get(k); if(x) d+=x*v; }
  return (na&&nb)? d/Math.sqrt(na*nb) : 0; }
function contain(a,b){ let hit=0,tot=0; const [sm,lg]= a.size<=b.size ? [a,b] : [b,a];
  for(const [k,v] of sm){ tot+=v; if(lg.has(k)) hit+=v; } return tot? hit/tot : 0; }

/* 특약·승계계약서는 본문 조를 명시적으로 인용한다 ("신탁계약 제11조에도 불구하고").
   그 인용이 있으면 가장 확실한 근거이므로 점수를 올린다. */
const RE_REF=/(?:신탁계약|본\s*계약|원\s*계약|원\s*도급계약)\s*제\s*(\d+)\s*조/g;
function refs(a){ if(a._r) return a._r;
  a._r=new Set([...(a.text||"").matchAll(RE_REF)].map(m=>+m[1])); return a._r; }
function artNo(a){ const m=/제(\d+)조/.exec(a.label||""); return m? +m[1] : null; }

function sim(a,b){
  a._t=a._t||ngrams(a.title,2); b._t=b._t||ngrams(b.title,2);
  a._b=a._b||ngrams(a.text,3);  b._b=b._b||ngrams(b.text,3);
  const na=artNo(a), bonus=(na!==null && refs(b).has(na)) ? 0.5 : 0;
  return Math.min(1, bonus + 0.35*contain(a._t,b._t) + 0.65*cos(a._b,b._b));
}
const GAP = 0.40;     // 한쪽을 비우는 비용
const FLOOR = 0.25;   // 이보다 낮으면 짝이 아니라 삭제+신설로 본다

function align(A, B){
  const n=A.length, m=B.length;
  const S=Array.from({length:n+1},()=>new Float64Array(m+1));
  const P=Array.from({length:n+1},()=>new Uint8Array(m+1)); // 1=대각 2=위(삭제) 3=왼쪽(신설)
  for(let i=1;i<=n;i++){ S[i][0]=S[i-1][0]-GAP; P[i][0]=2; }
  for(let j=1;j<=m;j++){ S[0][j]=S[0][j-1]-GAP; P[0][j]=3; }
  const SIM=Array.from({length:n},()=>new Float64Array(m));
  for(let i=0;i<n;i++) for(let j=0;j<m;j++) SIM[i][j]=sim(A[i],B[j]);
  for(let i=1;i<=n;i++) for(let j=1;j<=m;j++){
    const dg=S[i-1][j-1]+SIM[i-1][j-1], up=S[i-1][j]-GAP, lf=S[i][j-1]-GAP;
    if(dg>=up && dg>=lf){ S[i][j]=dg; P[i][j]=1; }
    else if(up>=lf){ S[i][j]=up; P[i][j]=2; }
    else { S[i][j]=lf; P[i][j]=3; }
  }
  const out=[]; let i=n,j=m;
  while(i>0||j>0){
    const p = (i>0&&j>0)?P[i][j] : (i>0?2:3);
    if(p===1){
      const s=SIM[i-1][j-1];
      if(s<FLOOR){ out.push({L:A[i-1],R:null,score:0}); out.push({L:null,R:B[j-1],score:0}); }
      else out.push({L:A[i-1],R:B[j-1],score:s});
      i--; j--;
    } else if(p===2){ out.push({L:A[i-1],R:null,score:0}); i--; }
    else { out.push({L:null,R:B[j-1],score:0}); j--; }
  }
  out.reverse();
  return out.map(r=>{
    let status;
    if(!r.R) status="deleted";
    else if(!r.L) status="inserted";
    else if(r.L.title!==r.R.title || r.L.text!==r.R.text) status="edited";
    else if(r.L.label!==r.R.label) status="moved";
    else status="same";
    return {...r, status};
  });
}
module.exports={align,sim};
