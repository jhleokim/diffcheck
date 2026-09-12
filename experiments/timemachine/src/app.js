const DATA = __DATA__;
const $ = id => document.getElementById(id);

/* ═══ 1. 정렬 엔진 — 순서 보존 전역 정렬(Needleman-Wunsch) ═══
   탐욕적 매칭은 조항 하나를 잘못 붙이면 그 뒤가 줄줄이 밀린다.
   NW는 전체 점수를 최적화하므로 그 연쇄가 생기지 않는다. */
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
const GAP=0.40, FLOOR=0.25;
function align(A,B){
  const n=A.length,m=B.length;
  const S=Array.from({length:n+1},()=>new Float64Array(m+1));
  const P=Array.from({length:n+1},()=>new Uint8Array(m+1));
  for(let i=1;i<=n;i++){S[i][0]=S[i-1][0]-GAP;P[i][0]=2;}
  for(let j=1;j<=m;j++){S[0][j]=S[0][j-1]-GAP;P[0][j]=3;}
  const SIM=Array.from({length:n},()=>new Float64Array(m));
  for(let i=0;i<n;i++)for(let j=0;j<m;j++)SIM[i][j]=sim(A[i],B[j]);
  for(let i=1;i<=n;i++)for(let j=1;j<=m;j++){
    const dg=S[i-1][j-1]+SIM[i-1][j-1],up=S[i-1][j]-GAP,lf=S[i][j-1]-GAP;
    if(dg>=up&&dg>=lf){S[i][j]=dg;P[i][j]=1;}
    else if(up>=lf){S[i][j]=up;P[i][j]=2;}else{S[i][j]=lf;P[i][j]=3;}
  }
  const out=[];let i=n,j=m;
  while(i>0||j>0){
    const p=(i>0&&j>0)?P[i][j]:(i>0?2:3);
    if(p===1){const s=SIM[i-1][j-1];
      if(s<FLOOR){out.push({L:A[i-1],R:null,score:0});out.push({L:null,R:B[j-1],score:0});}
      else out.push({L:A[i-1],R:B[j-1],score:s});
      i--;j--;
    }else if(p===2){out.push({L:A[i-1],R:null,score:0});i--;}
    else{out.push({L:null,R:B[j-1],score:0});j--;}
  }
  out.reverse();
  return out.map(r=>{
    let status;
    if(!r.R)status="deleted"; else if(!r.L)status="inserted";
    else if(r.L.title!==r.R.title||r.L.text!==r.R.text)status="edited";
    else if(r.L.label!==r.R.label)status="moved"; else status="same";
    const o={...r,status};
    if(r.L&&r.R){const d=wdiff(r.L.text,r.R.text);o.lh=d[0];o.rh=d[1];}
    return o;
  });
}
function esc(s){return s.replace(/[&<>]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;"}[c]));}
function wdiff(a,b){
  const at=a.match(/\S+|\s+/g)||[],bt=b.match(/\S+|\s+/g)||[];
  const n=at.length,m=bt.length;
  const D=Array.from({length:n+1},()=>new Uint32Array(m+1));
  for(let i=n-1;i>=0;i--)for(let j=m-1;j>=0;j--)
    D[i][j]=at[i]===bt[j]?D[i+1][j+1]+1:Math.max(D[i+1][j],D[i][j+1]);
  let i=0,j=0,ah="",bh="",da="",db="";
  const flush=()=>{ if(da)ah+="<del>"+esc(da)+"</del>"; if(db)bh+="<ins>"+esc(db)+"</ins>"; da=db=""; };
  while(i<n&&j<m){
    if(at[i]===bt[j]){flush();ah+=esc(at[i]);bh+=esc(bt[j]);i++;j++;}
    else if(D[i+1][j]>=D[i][j+1]){da+=at[i++];}
    else{db+=bt[j++];}
  }
  while(i<n)da+=at[i++];
  while(j<m)db+=bt[j++];
  flush();
  return[ah,bh];
}

/* ═══ 2. 조문 파서 — 붙여넣기·드롭한 텍스트를 조 단위로 ═══
   조 제목 정규식만으로는 두 군데서 무너진다.
     (1) 특약·승계계약서는 본문 조를 「신탁계약 제15조(분양)에도 불구하고」처럼 제목까지 붙여 인용한다.
         그대로 두면 인용문이 조 제목으로 잡혀 없는 조가 생긴다.
     (2) PDF에서 뽑은 텍스트는 줄바꿈이 아무 데나 들어가, 문장 중간의 「제22조」가 줄머리에 놓인다.
   그래서 ① 인용 접두어 뒤의 히트는 버리고 ② 번호가 역행하면 버리고 ③ 인식 결과를 warn으로 돌려준다.
   제목 없는 계약서(제1조 목적)는 제목 있는 조가 3개 미만일 때만 폴백으로 처리한다 —
   실물 PDF에서 제목 없는 히트를 같이 인정했더니 28조 문서가 18조로 줄었다. */
const RE_TITLED=/제\s*(\d+)\s*조(?:의\s*(\d+))?\s*\(([^)\n]{1,60})\)/g;
const RE_BARE  =/제\s*(\d+)\s*조(?:의\s*(\d+))?(?![\s(]*\()/g;
const RE_CITE  =/(?:신탁계약|본\s*계약|이\s*계약|원\s*계약|원\s*도급계약|동\s*계약|같은\s*법|이\s*법|위)\s*$/;

function scanArticles(t, re, needLineStart, warn){
  const out=[]; let m, last=0; re.lastIndex=0;
  while((m=re.exec(t))!==null){
    const no=+m[1], sub=m[2]?+m[2]:0, title=(m[3]||"").trim();
    const before=t.slice(Math.max(0,m.index-12), m.index);
    if(RE_CITE.test(before)){ warn.push(`다른 계약서 인용으로 보아 제외 — 제${no}조${title?`(${title})`:""}`); continue; }
    if(needLineStart && !/(^|\n)[ \t]*$/.test(before)) continue;
    if(no<last || (no===last && !sub)){ warn.push(`번호가 역행하여 제외 — 제${no}조${title?`(${title})`:""}`); continue; }
    last=no; out.push({at:m.index, len:m[0].length, no, sub, title});
  }
  return out;
}
function parseArticles(raw){
  let t=raw.replace(/\r/g,"");
  if(/<[a-z][\s\S]*>/i.test(t)){const d=document.createElement("div");d.innerHTML=t;t=d.textContent;}
  const warn=[];
  let hits=scanArticles(t, RE_TITLED, false, warn);
  if(hits.length<3){ warn.length=0; hits=scanArticles(t, RE_BARE, true, warn); }
  if(!hits.length)return Object.assign([],{warn});
  const arts=hits.map((h,k)=>({
    label:`제${h.no}조`+(h.sub?`의${h.sub}`:""),
    title:h.title,
    text:t.slice(h.at+h.len, k+1<hits.length?hits[k+1].at:t.length).replace(/\s+/g," ").trim().slice(0,1400)
  }));
  const max=hits[hits.length-1].no;
  if(arts.length<max)warn.push(`마지막 조가 제${max}조인데 ${arts.length}개만 인식됐습니다 — 누락 가능`);
  return Object.assign(arts,{warn});
}

/* ═══ 계약서 파일 판독 — hwpx / docx는 ZIP+XML이라 JSZip으로 직접 연다 ═══ */
function xmlText(xml, tag, paraEnd){
  // 태그 안의 텍스트만 모으고, 문단 끝에서 줄바꿈
  const out=[];
  const re=new RegExp(`<${tag}(?:\\s[^>]*)?>([\\s\\S]*?)</${tag}>|<\\/${paraEnd}>`,"g");
  let m;
  while((m=re.exec(xml))!==null){
    if(m[1]!==undefined) out.push(m[1].replace(/<[^>]+>/g,""));
    else out.push("\n");
  }
  return out.join("")
    .replace(/&lt;/g,"<").replace(/&gt;/g,">").replace(/&quot;/g,'"')
    .replace(/&#(\d+);/g,(_,d)=>String.fromCharCode(+d)).replace(/&amp;/g,"&");
}
function needZip(){
  if(typeof JSZip==="undefined"){
    const e=new Error("압축 해제 모듈(JSZip)을 불러오지 못했습니다. 네트워크가 차단된 환경이면 hwpx·docx 판독과 .docx 추출을 쓸 수 없습니다.");
    e.title="모듈 로드 실패"; e.guide=true; throw e;
  }
}
async function readHwpx(buf){
  needZip();
  const z=await JSZip.loadAsync(buf);
  const names=Object.keys(z.files)
    .filter(n=>/^Contents\/section\d+\.xml$/i.test(n))
    .sort((a,b)=>(+a.match(/\d+/)[0])-(+b.match(/\d+/)[0]));
  if(!names.length) throw new Error("hwpx 구조가 아닙니다");
  let t="";
  for(const n of names) t += xmlText(await z.file(n).async("string"),"hp:t","hp:p")+"\n";
  return t;
}
async function readDocx(buf){
  needZip();
  const z=await JSZip.loadAsync(buf);
  const f=z.file("word/document.xml");
  if(!f) throw new Error("docx 구조가 아닙니다");
  return xmlText(await f.async("string"),"w:t","w:p");
}
const LEGACY={hwp:["한글(HWP) 구버전","한글에서 열고 [다른 이름으로 저장] → 형식을 «한글 문서 (*.hwpx)»로 저장한 뒤 다시 올려주세요."],
              doc:["Word 구버전(DOC)","Word에서 열고 [다른 이름으로 저장] → 형식을 «Word 문서 (*.docx)»로 저장한 뒤 다시 올려주세요."],
              pdf:["PDF","현재 버전은 PDF 본문 추출을 지원하지 않습니다. 원본 hwpx·docx가 있으면 그쪽을 올려주세요."]};
async function readContract(file){
  const ext=(file.name.match(/\.([a-z0-9]+)$/i)||[,""])[1].toLowerCase();
  if(LEGACY[ext]){ const [n,how]=LEGACY[ext]; const e=new Error(how); e.title=n; e.guide=true; throw e; }
  if(ext==="hwpx") return await readHwpx(await file.arrayBuffer());
  if(ext==="docx") return await readDocx(await file.arrayBuffer());
  if(["txt","md","html","htm","xml"].includes(ext)) return await file.text();
  const e=new Error("지원하지 않는 형식입니다. hwpx 또는 docx로 올려주세요."); e.title=ext.toUpperCase(); e.guide=true; throw e;
}

/* ═══ 3. 상태 ═══ */
let SETI=0, VS=[];
let L=0, R=1, hover=-1, opened=new Set(), tab="hist", merge=new Map(), rows=[]
let checkSide=null;   // 문서 점검 탭이 보는 쪽 — 세트를 바꾸면 모드에 맞게 다시 정한다
function loadSet(i){
  SETI=i; const st=DATA.sets[i];
  MODE=st.mode||"version";
  VS=st.versions.map(v=>({...v, articles:v.articles.map(a=>({...a}))}));
  L=0; R=Math.min(1,VS.length-1); opened=new Set(); merge=new Map();
  checkSide=null;
  $("src").textContent=st.source||"";
}
/* 모드에 따라 같은 정렬 결과가 다른 의미를 갖는다.
   version: 버전 간 변경 추적 / override: 특약이 본문을 뒤집는 관계 */
const LABELS={
  version:{ SYM:{same:"=",moved:"⇅",edited:"~",inserted:"+",deleted:"−"},
            NAME:{same:"동일",moved:"번호 이동",edited:"내용 변경",inserted:"신설",deleted:"삭제"},
            fold:"same", foldText:n=>`동일한 조 ${n}개`,
            voidL:"이 버전에 없음", voidR:"삭제됨" },
  override:{ SYM:{same:"→",moved:"→",edited:"→",inserted:"+",deleted:"·",unmet:"⚠"},
             NAME:{same:"특약이 대체",moved:"특약이 대체",edited:"특약이 대체",
                   inserted:"본문에 없는 신규 특약",deleted:"특약 없음 (본문 그대로)",
                   unmet:"본문이 특약에 위임했는데 특약이 없음"},
             fold:"deleted", foldText:n=>`특약이 건드리지 않은 조 ${n}개`,
             voidL:"본문에 없음", voidR:"특약 없음" },
};
let MODE="version";
const SYM=()=>LABELS[MODE].SYM, NAME=()=>LABELS[MODE].NAME;

/* 본문이 스스로 판단을 특약에 넘긴 자리 — 실물 약관에서 5곳 확인됐다(설계 §2.1).
   그중 제29조①단서("…신탁특약에서 정하는 바에 따라 그 지급을 하지 않을 수 있다")는
   유보금의 유일한 근거다. 특약이 이 자리에 침묵하면 근거가 사라지는데,
   override 모드의 접기 규칙은 바로 그 경우를 "특약 없음 → 접기"로 화면에서 지운다.
   그래서 위임 문형이 있는 본문 조는 짝이 없을 때 접지 않고 최상단에 고정한다.
   문형: 신탁특약 … 정하는/정한  (중간에 20여 자가 끼는 형태까지 — 제28·29조의 귀속권리자) */
const RE_DELEG=/신탁특약[^.]{0,25}?정[하한]/;
const delegated=a=>!!a&&RE_DELEG.test(a.text||"");

/* ═══ 4. 렌더 ═══ */
function recompute(){
  rows=align(VS[L].articles, VS[R].articles);
  if(MODE==="override")
    rows.forEach(r=>{
      if(r.status!=="deleted"||!delegated(r.L))return;
      r.status="unmet";
      /* "특약에 없다"는 판정은 정렬이 맞았을 때만 참이다. 정렬이 짝을 놓쳤을 수도 있으므로
         단정하지 않는다.
         → 한때 "가장 가까운 특약"을 힌트로 붙였다가 뺐다. 세 건 모두 엉뚱한 조를 가리켰다
           (본문 제15조 분양 → 특약 제4조 신탁재산의 추가 편입 0.18). 최유사로 짝을 찾는 것은
           이 프로젝트가 이미 부정 결과로 확인한 방법이다(설계 §2.2, 3/35).
           틀린 단서를 주느니 "확인하라"고만 말하는 편이 낫다. */
    });
}

function render(){
  recompute();
  renderSets(); renderSeg(); renderRail(); renderHead(); renderRows(); renderInspector();
  hover=-1;
}
function renderSets(){
  const el=$("sets"); el.innerHTML="";
  DATA.sets.forEach((st,i)=>{
    const b=document.createElement("button"); b.type="button"; b.textContent=st.name;
    b.setAttribute("aria-pressed", i===SETI?"true":"false");
    b.onclick=()=>{ loadSet(i); render(); };
    el.appendChild(b);
  });
}
function renderSeg(){
  const s=$("seg"); s.innerHTML="";
  if(MODE==="override"){ s.style.display="none"; return; }
  s.style.display="";
  VS.forEach((v,i)=>{ if(i===0)return;
    const b=document.createElement("button"); b.type="button";
    b.textContent=`${VS[i-1].short} → ${v.short}`;
    b.setAttribute("aria-pressed", (L===i-1&&R===i)?"true":"false");
    b.onclick=()=>{L=i-1;R=i;opened=new Set();render();};
    s.appendChild(b);
  });
  const b=document.createElement("button"); b.type="button"; b.textContent="처음 → 끝";
  b.setAttribute("aria-pressed",(L===0&&R===VS.length-1&&VS.length>2)?"true":"false");
  b.onclick=()=>{L=0;R=VS.length-1;opened=new Set();render();};
  s.appendChild(b);
}
function renderHead(){
  $("hl").textContent=VS[L].label; $("hlm").textContent=`${VS[L].date} · ${VS[L].actor} · ${VS[L].articles.length}개 조`;
  $("hr").textContent=VS[R].label; $("hrm").textContent=`${VS[R].date} · ${VS[R].actor} · ${VS[R].articles.length}개 조`;
  const st={}; rows.forEach(r=>st[r.status]=(st[r.status]||0)+1);
  const rep=(st.edited||0)+(st.moved||0)+(st.same||0);
  $("tally").innerHTML = MODE==="override"
    ? `<span class="t-mod">대체 ${rep}</span><span class="t-add">신규 ${st.inserted||0}</span>`+
      (st.unmet?`<span class="t-del">위임 미이행 ${st.unmet}</span>`:"")+
      `<span style="opacity:.6">미변경 ${st.deleted||0}</span>`
    : `<span class="t-del">−${st.deleted||0}</span>`+
      `<span class="t-add">+${st.inserted||0}</span>`+
      `<span class="t-mod">~${(st.edited||0)+(st.moved||0)}</span>`;
  const pairs=rows.filter(r=>r.L&&r.R);
  const ver=pairs.filter(r=>r.L.uid&&r.R.uid);
  const ok=ver.filter(r=>r.L.uid===r.R.uid).length;
  const a=$("acc");
  if(ver.length){ a.textContent=`정렬 ${ok}/${ver.length}`+(ok<ver.length?` · 검수필요 ${ver.length-ok}`:"");
    a.className="acc"+(ok<ver.length?" bad":""); }
  else { a.textContent=`정렬쌍 ${pairs.length}`; a.className="acc"; }
}
function rowHTML(r,i){
  const long=d=>d&&d.text.length>190;
  const bad=(r.L&&r.R&&r.L.uid&&r.R.uid&&r.L.uid!==r.R.uid);
  const cell=(side,d,html)=> d
    ? `<div class="cell ${side}" data-row="${i}"><div><span class="ano">${d.label}</span><span class="atl">${esc(d.title)}</span></div>`+
      `<div class="atx${long(d)?" clamp":""}">${html||esc(d.text)}</div></div>`
    : side==="r"&&r.status==="unmet"
    ? `<div class="cell r void hint" data-row="${i}"><span class="voidm">특약에 대응 조문 없음</span>`+
      `<span class="hintm">본문이 특약에 넘긴 자리입니다. <b>특약이 침묵하면 근거가 사라집니다.</b><br>`+
      `정렬이 짝을 놓친 것은 아닌지도 함께 확인하세요</span></div>`
    : `<div class="cell ${side} void" data-row="${i}"><span class="voidm">${side==="r"?LABELS[MODE].voidR:LABELS[MODE].voidL}</span></div>`;
  const hi = MODE!=="override";   // 특약은 본문을 고친 게 아니라 새로 쓴 것이라 어절 diff가 의미 없다
  return cell("l",r.L,hi?r.lh:null)+
    `<div class="gut s-${r.status}" data-row="${i}" title="${NAME()[r.status]}${bad?" · 정렬 검수 필요":""}">`+
    `<span class="sym">${SYM()[r.status]}</span>${r.L&&r.R?`<span>${r.score.toFixed(2)}</span>`:""}</div>`+
    cell("r",r.R,hi?r.rh:null);
}
function renderRows(){
  const g=$("grid"); const out=[]; let run=[];
  // 위임 미이행은 "변화가 없어서" 눈에 안 띄는 항목이다. 접기 대상에서 빼는 것만으로는
  // 부족해서 최상단으로 끌어올린다. 인덱스는 data-row로 박히므로 순서를 바꿔도 트래킹은 유지된다.
  const pin=rows.reduce((v,r,i)=>(r.status==="unmet"&&v.push(i),v),[]);
  if(pin.length){
    out.push(`<div class="fold pin"><button type="button" disabled>⚠ 본문이 특약에 위임한 자리인데 특약이 없습니다 · ${pin.length}건`+
      `<span style="opacity:.7">${pin.map(i=>rows[i].L.label).join(" · ")}</span></button></div>`);
    pin.forEach(i=>out.push(rowHTML(rows[i],i)));
  }
  const flush=()=>{ if(!run.length)return;
    if(run.length>=3 && !opened.has(run[0])){
      const a=rows[run[0]],b=rows[run[run.length-1]];
      out.push(`<div class="fold"><button type="button" data-fold="${run[0]}">▸ ${LABELS[MODE].foldText(run.length)}`+
        `<span style="opacity:.6">${(a.L||a.R).label}–${(b.L||b.R).label}</span></button></div>`);
    } else run.forEach(i=>out.push(rowHTML(rows[i],i)));
    run=[]; };
  const FOLD=LABELS[MODE].fold;
  rows.forEach((r,i)=>{ if(r.status==="unmet")return;         // 위에서 이미 올렸다
    if(r.status===FOLD)run.push(i); else{flush();out.push(rowHTML(r,i));} });
  flush(); g.innerHTML=out.join("");
}
$("grid").addEventListener("click",e=>{
  const f=e.target.closest("[data-fold]");
  if(f){opened.add(+f.dataset.fold);renderRows();return;}
  const c=e.target.closest(".cell"); if(!c)return;
  document.querySelectorAll(`.cell[data-row="${c.dataset.row}"] .atx`).forEach(t=>t.classList.toggle("clamp"));
});

/* ═══ 5. 마우스 트래킹 + 좌우 동시 하이라이트 ═══ */
const sc=$("scroll"), ruler=$("ruler"); let raf=null,my=0;
function rowAt(y){
  const sr=sc.getBoundingClientRect();
  const el=document.elementFromPoint(sr.left+22,y); if(!el)return -1;
  const c=el.closest("[data-row]"); if(!c||c.parentElement!==$("grid"))return -1;
  return +c.dataset.row;
}
function select(i){
  $("grid").querySelectorAll(".is-track").forEach(e=>e.classList.remove("is-track"));
  hover=i;
  if(i<0){status(null);if(tab==="hist")renderInspector();return;}
  $("grid").querySelectorAll(`[data-row="${i}"]`).forEach(e=>e.classList.add("is-track"));
  status(rows[i]); if(tab==="hist")renderInspector();
}
sc.addEventListener("mousemove",e=>{ my=e.clientY; if(raf)return;
  raf=requestAnimationFrame(()=>{ raf=null;
    const sr=sc.getBoundingClientRect();
    ruler.classList.add("on"); ruler.style.top=(my-sr.top+sc.scrollTop)+"px";
    const i=rowAt(my); if(i!==hover)select(i);
  });
});
sc.addEventListener("mouseleave",()=>{ ruler.classList.remove("on");
  $("grid").querySelectorAll(".is-track").forEach(e=>e.classList.remove("is-track"));
  hover=-1; status(null); if(tab==="hist")renderInspector(); });
function status(r){
  if(!r){$("stLive").textContent="조문 위에 마우스를 올리면 좌·우가 동시에 추적됩니다";
    $("stSep").textContent="";$("stDet").textContent="";return;}
  $("stLive").textContent=`${r.L?r.L.label:"—"} ↔ ${r.R?r.R.label:"—"}`;
  $("stSep").textContent="│";
  const b=[NAME()[r.status]];
  if(r.L&&r.R){ b.push(`신뢰도 ${r.score.toFixed(2)}`);
    if(r.L.uid&&r.R.uid&&r.L.uid!==r.R.uid)b.push("⚠ 정렬 검수 필요");
    if(MODE!=="override"){
      const ins=(r.rh.match(/<ins>/g)||[]).length, del=(r.lh.match(/<del>/g)||[]).length;
      if(ins||del)b.push(`추가 ${ins}곳 · 삭제 ${del}곳`); } }
  $("stDet").textContent=b.join(" · ");
}

/* ═══ 6. 버전 레일 — 드래그로 순서 변경/끼워넣기, 체크로 대비표 대상 선택 ═══ */
let dragFrom=null;
function renderRail(){
  const list=$("vlist"); list.innerHTML=""; $("vcount").textContent=`${VS.length}개`;
  VS.forEach((v,i)=>{
    const dz=document.createElement("div"); dz.className="vdrop"; dz.dataset.at=i; list.appendChild(dz);
    const c=document.createElement("div");
    c.className="vcard"+(i===L?" isL":"")+(i===R?" isR":"");
    c.draggable=true; c.dataset.i=i;
    c.innerHTML=`<div class="vtop"><input class="vchk" type="checkbox" data-c="${i}">`+
      `<span class="vname">${esc(v.label)}</span>`+
      `<button class="vstar${v.final?" on":""}" data-star="${i}" type="button" `+
      `title="${v.final?"최종본 지정 해제":"이 버전을 최종본으로 지정"}">${v.final?"★":"☆"}</button>`+
      `<span class="vside">${i===L?"좌":i===R?"우":""}</span></div>`+
      `<div class="vmeta">${v.date} · ${v.actor} · ${v.articles.length}조</div>`+
      (v.final?`<div class="vfinal">최종본</div>`:``);
    c.addEventListener("dragstart",e=>{dragFrom=i;c.classList.add("dragging");e.dataTransfer.effectAllowed="move";});
    c.addEventListener("dragend",()=>{dragFrom=null;c.classList.remove("dragging");
      document.querySelectorAll(".vdrop").forEach(d=>d.classList.remove("over"));});
    c.addEventListener("click",e=>{
      if(e.target.classList.contains("vchk"))return;
      if(e.target.dataset.star!==undefined){e.stopPropagation();setFinal(+e.target.dataset.star);return;}
      if(e.shiftKey||i<L){L=i; if(R<=L)R=Math.min(VS.length-1,L+1);} else R=i;
      if(L===R){L=Math.max(0,R-1);} opened=new Set(); render();
    });
    list.appendChild(c);
  });
  const dz=document.createElement("div"); dz.className="vdrop"; dz.dataset.at=VS.length; list.appendChild(dz);
  list.querySelectorAll(".vdrop").forEach(d=>{
    d.addEventListener("dragover",e=>{e.preventDefault();d.classList.add("over");});
    d.addEventListener("dragleave",()=>d.classList.remove("over"));
    d.addEventListener("drop",e=>{
      e.preventDefault(); d.classList.remove("over");
      if(dragFrom===null)return;
      let at=+d.dataset.at; const v=VS[dragFrom];
      VS.splice(dragFrom,1); if(at>dragFrom)at--;
      VS.splice(at,0,v); dragFrom=null;
      L=Math.min(L,VS.length-2); R=L+1; opened=new Set(); render();
    });
  });
  list.querySelectorAll(".vchk").forEach(k=>k.addEventListener("change",()=>{
    const sel=[...list.querySelectorAll(".vchk:checked")];
    if(sel.length>2){k.checked=false;return;}
    $("btnCmp").disabled = sel.length!==2;
  }));
}
function selectedPair(){
  const s=[...$("vlist").querySelectorAll(".vchk:checked")].map(k=>+k.dataset.c).sort((a,b)=>a-b);
  return s.length===2?s:null;
}

/* ═══ 7. 버전 추가 — 붙여넣기 / 드래그앤드롭 ═══ */
function addVersion(articles,label,actor){
  if(!articles.length){alert("조문을 찾지 못했습니다. 「제1조(총칙)」 형식의 조 제목이 있어야 합니다.");return;}
  const d=new Date();
  VS.push({id:"u"+Date.now(),label:label||`추가 버전 ${VS.length+1}`,
    short:label?label.slice(0,4):`v${VS.length}`,
    date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,
    actor:actor||"직접 추가",articles});
  L=VS.length-2; R=VS.length-1; opened=new Set(); render();
}
$("btnPaste").onclick=()=>openModal("paste");
const dz=$("dz");
["dragenter","dragover"].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.add("over");}));
["dragleave","drop"].forEach(t=>dz.addEventListener(t,e=>{e.preventDefault();dz.classList.remove("over");}));
dz.addEventListener("drop",async e=>{
  const f=e.dataTransfer.files[0]; if(!f)return;
  const old=dz.textContent; dz.textContent="읽는 중…";
  try{
    const txt=await readContract(f);
    const arts=parseArticles(txt);
    if(!arts.length) throw Object.assign(new Error(
      "조문을 찾지 못했습니다. 「제1조(총칙)」 형식의 조 제목이 있는 계약서인지 확인해주세요."),{title:"조문 인식 실패",guide:true});
    addVersion(arts, f.name.replace(/\.[^.]+$/,""), "파일");
    if(arts.warn&&arts.warn.length)openModal("warn",{name:f.name,n:arts.length,warn:arts.warn});
  }catch(err){
    openModal("err",{title:err.title||"파일을 읽지 못했습니다", msg:err.message, name:f.name});
  }finally{ dz.innerHTML=DZ_HTML; }
});
const DZ_HTML=dz.innerHTML;

/* ═══ 8-0. 단일 문서 점검 — 비교 상대가 없어도 동작한다 (설계 §8.4) ═══
   전부 정규식이고 도메인 룰을 요구하지 않는다. 실물 신고 약관 한 건에서 아래가 전부 나왔다. */

/* (1) 잔존 공란. 체결 직전 문서에 남아 있으면 사고다. */
const BLANKS=[["빈칸 [ ]",/\[\s+\]/g],["밑줄 공란",/_{3,}/g],["빈 괄호",/\(\s{2,}\)/g],
              ["날짜 미기재",/년\s+월\s+일/g],["○○ 표기",/[○◯]{2,}/g],["미정 표기",/(?:TBD|미정|추후\s*협의)/g]];
function scanBlanks(arts){
  const out=[];
  for(const a of arts)for(const [name,re] of BLANKS){
    re.lastIndex=0; let m;
    while((m=re.exec(a.text||""))!==null)
      out.push({label:a.label,kind:name,ctx:a.text.slice(Math.max(0,m.index-22),m.index+m[0].length+12)});
  }
  return out;
}
/* (2) 상호참조 무결성. 조가 신설·삭제되면 번호는 밀리는데 본문 속 인용 숫자는 안 따라간다.
   두 가지를 반드시 걸러야 한다 — 안 그러면 오탐이 실제로 났다:
     · 법령 인용 (「건설산업기본법」 제54조) — 우리 문서의 조가 아니다
     · 다른 계약서 인용 (신탁계약 제33조) — 특약이 본문을 부르는 정상적인 참조 */
const RE_LAW=/(?:법|법률|시행령|시행규칙|규칙|조례|약관|규정|기준)\s*$/;
const RE_XDOC=/(?:신탁계약|본\s*계약|이\s*계약|원\s*계약|원\s*도급계약|동\s*계약)\s*$/;
function scanRefs(arts){
  const have=new Set(arts.map(a=>(a.label||"").replace(/\s/g,"")));
  const out=[]; let total=0;
  for(const a of arts){
    const re=/제\s*(\d+)\s*조(?:의\s*(\d+))?/g; let m;
    while((m=re.exec(a.text||""))!==null){
      const before=(a.text||"").slice(Math.max(0,m.index-14),m.index);
      if(RE_LAW.test(before)||RE_XDOC.test(before))continue;
      total++;
      const lab=`제${m[1]}조`+(m[2]?`의${m[2]}`:"");
      if(!have.has(lab))out.push({label:a.label,to:lab});
    }
  }
  return {total,broken:out};
}
/* (3) 용어 외연. 한 계약서 안에서 '수익자'의 범위가 세 번 달라지는 것이 실물에서 확인됐다.
   법률문서에서 이건 오류가 아니라 의도된 국소 재정의라서 — 판정하지 않고 목록만 낸다. */
const RE_SCOPE=/(?:[^\s(（]{2,12})\s*[((][^)）]{0,40}?(?:포함한다|포함하지\s*아니한다|포함되지\s*아니하며|포함되지\s*않으며|제외한다)/g;
function scanScope(arts){
  const out=[];
  for(const a of arts){ RE_SCOPE.lastIndex=0; let m;
    while((m=RE_SCOPE.exec(a.text||""))!==null)out.push({label:a.label,ctx:m[0]});
  }
  return out;
}

/* ═══ 8. 인스펙터: 조항 이력 / 문서 점검 / 검토본 만들기 ═══ */
$("tabHist").onclick=()=>{tab="hist";syncTabs();renderInspector();};
$("tabCheck").onclick=()=>{tab="check";syncTabs();renderInspector();};
$("tabMerge").onclick=()=>{tab="merge";syncTabs();renderInspector();};
function syncTabs(){$("tabHist").setAttribute("aria-selected",tab==="hist");
  $("tabCheck").setAttribute("aria-selected",tab==="check");
  $("tabMerge").setAttribute("aria-selected",tab==="merge");}
function renderInspector(){
  const b=$("ibody");
  if(tab==="hist"){
    const r=hover>=0?rows[hover]:null;
    if(!r){b.innerHTML=`<div class="ih">조항 이력</div><div class="iempty">조문 위에 마우스를 올리면 그 조항이 모든 버전에서 어떻게 움직였는지 보여줍니다.</div>`;return;}
    const probe=r.R||r.L;
    const steps=VS.map(v=>{
      let best=null,bs=0;
      for(const a of v.articles){const s=sim(probe,a); if(s>bs){bs=s;best=a;}}
      return {v,a:bs>=0.55?best:null,s:bs};
    });
    const mx=Math.max(...steps.map(x=>x.a?x.a.text.length:0),1);
    let prev=null;
    const html=steps.map(x=>{
      let cls="";
      if(!x.a)cls="gone";
      else if(!prev)cls="born";
      else if(prev.label!==x.a.label||prev.text!==x.a.text)cls="chg";
      const row=`<div class="ls ${cls}"><span class="v">${esc(x.v.short)}</span>`+
        `<span class="lb">${x.a?x.a.label:"없음"}</span>`+
        `<span class="bar"><i style="width:${x.a?Math.round(x.a.text.length/mx*100):0}%"></i></span></div>`;
      if(x.a)prev=x.a; return row;
    }).join("");
    b.innerHTML=`<div class="ih">조항 이력</div><div class="lt">${esc(probe.title)}</div>${html}`+
      `<div class="note">막대 길이 = 조문 분량. 색이 바뀐 회차가 그 조항이 실제로 손대진 지점입니다.</div>`;
    return;
  }
  if(tab==="check"){
    // 이 탭은 비교가 아니라 문서 한 건을 본다. 그래서 어느 쪽을 볼지 고르게 한다 —
    // 버전 비교에서는 최신 제출본(우), 본문↔특약에서는 신고 약관 본문(좌)이 보통 관심 대상이다.
    if(checkSide===null)checkSide=MODE==="override"?"L":"R";
    const v=checkSide==="L"?VS[L]:VS[R], arts=v.articles;
    const bl=scanBlanks(arts), rf=scanRefs(arts), sc=scanScope(arts);
    const sec=(t,n,body,tone)=>`<div class="ck ${tone||""}"><div class="ckh">${t}`+
      `<span class="ckn">${n}</span></div>${body}</div>`;
    b.innerHTML=`<div class="ih">문서 점검</div>`+
      `<div class="mpick" style="margin-bottom:9px">`+
      `<button type="button" data-side="L" aria-pressed="${checkSide==="L"}">${esc(VS[L].short)}</button>`+
      `<button type="button" data-side="R" aria-pressed="${checkSide==="R"}">${esc(VS[R].short)}</button></div>`+
      `<div class="lt">${esc(v.label)} · ${arts.length}개 조</div>`+
      sec("잔존 공란",bl.length, bl.length
        ? bl.map(x=>`<div class="cki"><b>${esc(x.label)}</b> ${esc(x.kind)}<span>…${esc(x.ctx)}…</span></div>`).join("")
        : `<div class="cki ok">남아 있는 공란이 없습니다</div>`, bl.length?"bad":"")+
      sec("깨진 상호참조",rf.broken.length, rf.broken.length
        ? rf.broken.map(x=>`<div class="cki"><b>${esc(x.label)}</b> → ${esc(x.to)} <span>그 조가 이 문서에 없습니다</span></div>`).join("")
        : `<div class="cki ok">내부 참조 ${rf.total}건 모두 실재하는 조를 가리킵니다</div>`, rf.broken.length?"bad":"")+
      sec("용어 범위의 국소 재정의",sc.length, sc.length
        ? sc.map(x=>`<div class="cki"><b>${esc(x.label)}</b><span>${esc(x.ctx)}</span></div>`).join("")
        : `<div class="cki ok">범위를 다시 정의하는 표현이 없습니다</div>`)+
      `<div class="note">공란과 참조는 <b>사고</b>이므로 고쳐야 합니다. 용어 재정의는 법률문서에서 흔히 <b>의도된 것</b>이라 `+
      `판정하지 않고 목록만 냅니다 — 같은 낱말의 범위가 조마다 다른지 직접 보세요.</div>`;
    b.querySelectorAll("[data-side]").forEach(btn=>btn.onclick=()=>{
      checkSide=btn.dataset.side; renderInspector(); });
    return;
  }
  // 검토본 만들기
  const chg=rows.map((r,i)=>({r,i})).filter(x=>x.r.status!=="same");
  const list=chg.map(({r,i})=>{
    const p=merge.get(i)||(r.R?"R":"L");
    const t=(r.R||r.L);
    return `<div class="mrow"><div class="mt">${esc(t.label)} ${esc(t.title)} · ${NAME()[r.status]}</div>`+
      `<div class="mpick">`+
      `<button type="button" data-m="${i}" data-p="L" aria-pressed="${p==="L"}" ${r.L?"":"disabled"}>좌 채택</button>`+
      `<button type="button" data-m="${i}" data-p="R" aria-pressed="${p==="R"}" ${r.R?"":"disabled"}>우 채택</button>`+
      `<button type="button" data-m="${i}" data-p="X" aria-pressed="${p==="X"}">제외</button>`+
      `</div></div>`;
  }).join("");
  b.innerHTML=`<div class="ih">검토본 만들기 · 변경 ${chg.length}건</div>`+
    (chg.length?list:`<div class="iempty">두 버전이 동일합니다.</div>`)+
    `<div style="display:flex;gap:6px;margin-top:10px">`+
    `<button class="btn pri" id="btnMake" style="flex:1">검토본 생성</button>`+
    `<button class="btn" id="btnDocx" style="flex:1">계약서 추출</button></div>`+
    `<div class="note">동일한 조는 자동으로 그대로 계승됩니다. 생성하면 타임라인 마지막 버전이 되고, 확정되면 버전 카드의 ☆를 눌러 최종본으로 지정할 수 있습니다.</div>`;
  b.querySelectorAll("[data-m]").forEach(btn=>btn.onclick=()=>{
    merge.set(+btn.dataset.m,btn.dataset.p); renderInspector();
  });
  $("btnMake").onclick=makeFinal;
  $("btnDocx").onclick=()=>exportContract(buildFinal());
}
function buildFinal(){
  const out=[];
  rows.forEach((r,i)=>{
    if(r.status==="same"){out.push(r.R||r.L);return;}
    const p=merge.get(i)||(r.R?"R":"L");
    if(p==="X")return;
    const pick=p==="L"?r.L:r.R;
    if(pick)out.push(pick);
  });
  return out.map((a,k)=>({label:`제${k+1}조`,title:a.title,text:a.text}));
}
function makeFinal(){
  const arts=buildFinal();
  const d=new Date();
  const n=VS.filter(v=>/^검토본/.test(v.label)).length+1;
  VS.push({id:"rev"+Date.now(),label:`검토본 ${n}차`,short:`검토${n}`,
    date:`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`,
    actor:"검토",articles:arts});
  L=VS.length-2; R=VS.length-1; opened=new Set(); merge=new Map(); render();
}
/* 어떤 버전이든 언제든 최종본으로 지정/해제 — 한 번에 하나만 */
function setFinal(i){
  const on=!VS[i].final;
  VS.forEach(v=>v.final=false);
  VS[i].final=on;
  renderRail(); renderHead();
}

/* ═══ 9. 문서 추출 — JSZip으로 실제 .docx(OOXML) 생성 ═══ */
let DL=null;
(async()=>{ try{ if(window.claude&&claude.use) DL=await claude.use("downloads"); }catch(e){} })();
async function saveFile(filename,data){
  if(DL){ try{ await DL.save({filename,data}); return "saved"; }
    catch(e){ if(e&&e.code==="declined")return "declined";
      console.warn("downloads:",e&&e.code); } }
  try{ const blob=data instanceof Blob?data:new Blob([data]);
    const a=document.createElement("a"); a.href=URL.createObjectURL(blob);
    a.download=filename; document.body.appendChild(a); a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1000); return "saved";
  }catch(e){ return "failed"; }
}
function xe(s){return String(s==null?"":s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));}
function para(text,opt={}){
  const rpr=`<w:rPr>${opt.b?"<w:b/>":""}${opt.color?`<w:color w:val="${opt.color}"/>`:""}`+
    `<w:sz w:val="${opt.sz||18}"/><w:szCs w:val="${opt.sz||18}"/></w:rPr>`;
  const segs=String(text||"").split("\n");
  return segs.map(s=>`<w:p><w:pPr><w:spacing w:after="0" w:line="240" w:lineRule="auto"/>`+
    `${opt.align?`<w:jc w:val="${opt.align}"/>`:""}</w:pPr>`+
    `<w:r>${rpr}<w:t xml:space="preserve">${xe(s)}</w:t></w:r></w:p>`).join("");
}
function cell(content,w,fill){
  return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>`+
    (fill?`<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>`:"")+
    `<w:tcMar><w:top w:w="60" w:type="dxa"/><w:bottom w:w="60" w:type="dxa"/>`+
    `<w:left w:w="90" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tcMar>`+
    `</w:tcPr>${content}</w:tc>`;
}
const BORDERS=`<w:tblBorders>`+
  ["top","left","bottom","right","insideH","insideV"].map(s=>
    `<w:${s} w:val="single" w:sz="4" w:space="0" w:color="B7BEC6"/>`).join("")+`</w:tblBorders>`;
async function docxBlob(bodyXml,landscape){
  needZip();
  const sect = landscape
    ? `<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/>`+
      `<w:pgMar w:top="850" w:right="850" w:bottom="850" w:left="850"/></w:sectPr>`
    : `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>`+
      `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134"/></w:sectPr>`;
  const doc=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
    `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`+
    `<w:body>${bodyXml}${sect}</w:body></w:document>`;
  const ct=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`+
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`+
    `<Default Extension="xml" ContentType="application/xml"/>`+
    `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>`+
    `</Types>`;
  const rels=`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`+
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`+
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>`+
    `</Relationships>`;
  const zip=new JSZip();
  zip.file("[Content_Types].xml",ct);
  zip.folder("_rels").file(".rels",rels);
  zip.folder("word").file("document.xml",doc);
  return await zip.generateAsync({type:"blob",
    mimeType:"application/vnd.openxmlformats-officedocument.wordprocessingml.document"});
}
/* 산출물 2 규격: 가로 A4 · No./조항/【전】/【후】/사유 · 지정 색상 */
function cmpRows(a,b){
  const rs=align(a.articles,b.articles);
  let n=0;
  return rs.filter(r=>r.status!=="same").map(r=>{
    n++;
    const t=(r.R||r.L);
    const reason={inserted:"신설 조항 — 도입 취지와 법리 근거 확인 필요",
      deleted:"삭제된 조항 — 삭제 사유와 대체 장치 확인 필요",
      edited:"본문 변경 — 변경된 어절의 의미 변화 검토",
      moved:"조 번호 이동 — 내용 동일, 인용 조문 정합성 확인"}[r.status];
    return {no:`${{inserted:"A",deleted:"B",edited:"C",moved:"D"}[r.status]}-${n}`,
      clause:`${t.label} ${t.title}`,
      before:r.L?`${r.L.label} ${r.L.title}\n${r.L.text}`:"(해당 조항 없음)",
      after:r.R?`${r.R.label} ${r.R.title}\n${r.R.text}`:"(삭제됨)",
      reason, status:r.status};
  });
}
async function exportCompare(li,ri){
  const a=VS[li],b=VS[ri],data=cmpRows(a,b);
  const head=`<w:tr><w:trPr><w:tblHeader/></w:trPr>`+
    [["No.",900],["조항",2400],["【전】 "+a.label,4300],["【후】 "+b.label,4300],["수정 사유 / 법리근거",3200]]
      .map(([t,w])=>cell(para(t,{b:true,color:"FFFFFF",sz:17}),w,"1F3A5F")).join("")+`</w:tr>`;
  const body=data.map(d=>`<w:tr>`+
    cell(para(d.no,{sz:16,b:true}),900)+
    cell(para(d.clause,{sz:16}),2400)+
    cell(para(d.before,{sz:16,color:"C00000"}),4300,"FFF5F5")+
    cell(para(d.after,{sz:16,color:"0070C0"}),4300,"F0F8E8")+
    cell(para(d.reason,{sz:16}),3200,"FFFEF0")+`</w:tr>`).join("");
  const xml=para(`${a.label} → ${b.label} 변경 대비표`,{b:true,sz:28})+
    para(`${a.date} → ${b.date} · 변경 ${data.length}건 · diffcheck 자동 생성`,{sz:16,color:"666666"})+
    para("")+
    `<w:tbl><w:tblPr><w:tblW w:w="15100" w:type="dxa"/>${BORDERS}</w:tblPr>${head}${body}</w:tbl>`;
  let blob; try{ blob=await docxBlob(xml,true); }
  catch(e){ openModal("err",{title:e.title||"추출 실패",msg:e.message,name:"대비표.docx"}); return; }
  const r=await saveFile(`대비표_${a.short}_${b.short}.docx`,blob);
  if(r==="failed")openModal("err",{title:"추출 실패",msg:"파일을 저장하지 못했습니다.",name:"대비표.docx"});
}
async function exportContract(arts){
  // "최종본"이라 부르지 않는다 — 무엇이 최종이 될지는 검토가 끝나야 안다(설계 §7.7).
  const xml=para("계약서 검토본",{b:true,sz:32,align:"center"})+
    para(`diffcheck 검토 결과 · ${arts.length}개 조`,{sz:16,color:"666666",align:"center"})+para("")+
    arts.map(a=>para(`${a.label}(${a.title})`,{b:true,sz:20})+para(a.text,{sz:18})+para("")).join("");
  let blob; try{ blob=await docxBlob(xml,false); }
  catch(e){ openModal("err",{title:e.title||"추출 실패",msg:e.message,name:"계약서.docx"}); return; }
  const r=await saveFile(`계약서_${(VS[R].label||"검토본").replace(/\s/g,"")}.docx`,blob);
  if(r==="failed")openModal("err",{title:"추출 실패",msg:"파일을 저장하지 못했습니다.",name:"계약서.docx"});
}

/* ═══ 10. 모달 ═══ */
const mask=$("mask"),modal=$("modal");
mask.addEventListener("click",e=>{if(e.target===mask)closeModal();});
function closeModal(){mask.classList.remove("on");modal.innerHTML="";}
function openModal(kind,arg){
  if(kind==="paste"){
    modal.innerHTML=`<h2>붙여넣기로 버전 추가</h2><div class="mb">`+
      `<div class="fld"><label>버전 이름</label><input type="text" id="pName" placeholder="예: 시공사 3차 제출"></div>`+
      `<div class="fld"><label>작성 주체</label><input type="text" id="pActor" placeholder="예: 시공사"></div>`+
      `<div class="fld"><label>계약서 전문 — 「제1조(총칙)」 형식의 조 제목이 있어야 인식됩니다</label>`+
      `<textarea id="pText" placeholder="제1조(총칙) ...&#10;제2조(정의) ..."></textarea></div></div>`+
      `<div class="mf"><button class="btn" id="pC">취소</button><button class="btn pri" id="pO">추가</button></div>`;
    $("pC").onclick=closeModal;
    $("pO").onclick=()=>{ const arts=parseArticles($("pText").value);
      if(!arts.length){alert("조문을 찾지 못했습니다.");return;}
      addVersion(arts,$("pName").value.trim()||null,$("pActor").value.trim()||null); closeModal();
      if(arts.warn&&arts.warn.length)openModal("warn",{name:"붙여넣은 텍스트",n:arts.length,warn:arts.warn}); };
  }
  if(kind==="err"){
    modal.innerHTML=`<h2>${esc(arg.title)}</h2><div class="mb">`+
      `<div style="font-family:var(--mono);font-size:11px;color:var(--ink-3);margin-bottom:9px">${esc(arg.name)}</div>`+
      `<div style="font-size:12.5px;line-height:1.75">${esc(arg.msg)}</div>`+
      `<div class="note" style="margin-top:12px">지원 형식: <b>.hwpx</b> · <b>.docx</b> · .txt · .md<br>`+
      `구버전 .hwp / .doc와 .pdf는 본문 구조를 신뢰할 수 있게 읽어낼 수 없어 받지 않습니다.</div></div>`+
      `<div class="mf"><button class="btn pri" id="eC">확인</button></div>`;
    $("eC").onclick=closeModal;
  }
  if(kind==="warn"){
    // 조 인식은 끝났지만 미심쩍은 것이 남았다. 진행은 막지 않되 숨기지도 않는다(§7.4와 같은 원칙).
    modal.innerHTML=`<h2>조 ${arg.n}개를 인식했습니다 — 확인이 필요합니다</h2><div class="mb">`+
      `<div style="font-family:var(--mono);font-size:11px;color:var(--ink-3);margin-bottom:9px">${esc(arg.name)}</div>`+
      `<ul style="font-size:12.5px;line-height:1.9;padding-left:18px;margin:0">`+
      arg.warn.map(w=>`<li>${esc(w)}</li>`).join("")+`</ul>`+
      `<div class="note" style="margin-top:12px">인용문이 조 제목으로 잘못 잡히는 것을 막기 위해 걸러낸 것입니다. `+
      `실제 조가 빠졌다면 해당 부분을 붙여넣기로 따로 추가해주세요.</div></div>`+
      `<div class="mf"><button class="btn pri" id="wC">확인</button></div>`;
    $("wC").onclick=closeModal;
  }
  if(kind==="cmp"){
    const [li,ri]=arg, a=VS[li], b=VS[ri], data=cmpRows(a,b);
    modal.innerHTML=`<h2>${esc(a.label)} → ${esc(b.label)} 변경 대비표 · ${data.length}건</h2>`+
      `<div class="mb"><table class="cmp">`+
      `<colgroup><col style="width:7%"><col style="width:16%"><col style="width:28%">`+
      `<col style="width:28%"><col style="width:21%"></colgroup>`+
      `<thead><tr><th>No.</th><th>조항</th>`+
      `<th>【전】 ${esc(a.short)}</th><th>【후】 ${esc(b.short)}</th><th>수정 사유</th></tr></thead><tbody>`+
      data.map(d=>`<tr><td class="no">${d.no}</td><td>${esc(d.clause)}</td>`+
        `<td class="o">${esc(d.before).replace(/\n/g,"<br>").slice(0,420)}</td>`+
        `<td class="n">${esc(d.after).replace(/\n/g,"<br>").slice(0,420)}</td>`+
        `<td class="w">${esc(d.reason)}</td></tr>`).join("")+
      `</tbody></table></div>`+
      `<div class="mf"><button class="btn" id="cC">닫기</button>`+
      `<button class="btn pri" id="cO">.docx 추출 (가로 A4)</button></div>`;
    $("cC").onclick=closeModal;
    $("cO").onclick=async()=>{ await exportCompare(li,ri); closeModal(); };
  }
  mask.classList.add("on");
}
$("btnCmp").onclick=()=>{ const p=selectedPair(); if(p)openModal("cmp",p); };

loadSet(0); render(); syncTabs();
