# -*- coding: utf-8 -*-
import io
data = io.open("rounds.json", encoding="utf-8").read()

HTML = r"""<title>계약서 협상 타임머신</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+KR:wght@400;500;600&family=JetBrains+Mono:wght@400;500;700&family=Noto+Serif+KR:wght@400;500;600&display=swap">
<style>
:root{
  --surface-app:#0f1418; --surface-panel:#161d23; --surface-rail:#12181d;
  --surface-doc:#ffffff; --surface-doc-alt:#f6f8f9; --surface-gutter:#eef1f3;
  --text-doc:#181d22; --text-doc-dim:#5d6a75;
  --text-chrome:#dbe3ea; --text-chrome-dim:#78848f;
  --rule-doc:#e2e7ea; --rule-chrome:#242d35;
  --sem-removed:#b23a32; --sem-removed-wash:#fbeae7;
  --sem-added:#1f6f52;   --sem-added-wash:#e5f2ec;
  --sem-moved:#8f6412;   --sem-moved-wash:#faf0d9;
  --sem-track:#e8b52c;   --sem-track-wash:#fff8e0;
  --sem-warn:#b23a32;
  --action:#2b7480;
  --font-ui:"IBM Plex Sans KR","Malgun Gothic",sans-serif;
  --font-doc:"Noto Serif KR","Batang",serif;
  --font-mono:"JetBrains Mono",ui-monospace,Consolas,monospace;
}
@media (prefers-color-scheme:dark){:root:not([data-theme="light"]){
  --surface-doc:#141a1f; --surface-doc-alt:#11171b; --surface-gutter:#0d1216;
  --text-doc:#dde4ea; --text-doc-dim:#8593a0; --rule-doc:#232c34;
  --sem-removed:#e08c85; --sem-removed-wash:#2e1b1a;
  --sem-added:#6cc09b;   --sem-added-wash:#132620;
  --sem-moved:#d6a748;   --sem-moved-wash:#2a2213;
  --sem-track:#e8b52c;   --sem-track-wash:#2b2410;
  --action:#63b3bf;
}}
:root[data-theme="dark"]{
  --surface-doc:#141a1f; --surface-doc-alt:#11171b; --surface-gutter:#0d1216;
  --text-doc:#dde4ea; --text-doc-dim:#8593a0; --rule-doc:#232c34;
  --sem-removed:#e08c85; --sem-removed-wash:#2e1b1a;
  --sem-added:#6cc09b;   --sem-added-wash:#132620;
  --sem-moved:#d6a748;   --sem-moved-wash:#2a2213;
  --sem-track:#e8b52c;   --sem-track-wash:#2b2410;
  --action:#63b3bf;
}
*{box-sizing:border-box}
body{margin:0;background:var(--surface-app);color:var(--text-chrome);
  font-family:var(--font-ui);-webkit-font-smoothing:antialiased;overflow:hidden}

/* ── 앱 크롬 ── */
.app{display:flex;flex-direction:column;height:100vh}
.chrome{background:var(--surface-app);border-bottom:1px solid var(--rule-chrome);flex:none}
.chrome-top{display:flex;align-items:center;gap:18px;padding:9px 16px;flex-wrap:wrap}
.brand{display:flex;align-items:baseline;gap:7px;font-family:var(--font-mono);
  font-size:13px;font-weight:700;letter-spacing:-.02em;flex:none}
.brand .dot{width:7px;height:7px;background:var(--sem-track);display:inline-block}
.brand .sub{font-family:var(--font-ui);font-size:11px;font-weight:400;color:var(--text-chrome-dim)}
.rounds{display:flex;gap:0;border:1px solid var(--rule-chrome);border-radius:4px;overflow:hidden}
.round-tab{all:unset;cursor:pointer;padding:5px 12px;font-size:12px;color:var(--text-chrome-dim);
  border-right:1px solid var(--rule-chrome);white-space:nowrap;transition:background .1s,color .1s}
.round-tab:last-child{border-right:0}
.round-tab:hover{background:var(--surface-panel);color:var(--text-chrome)}
.round-tab[aria-selected="true"]{background:var(--action);color:#fff}
.round-tab:focus-visible{outline:2px solid var(--sem-track);outline-offset:-2px}
.tally{display:flex;gap:11px;font-family:var(--font-mono);font-size:12px;margin-left:auto;align-items:center}
.tally .t-del{color:var(--sem-removed)} .tally .t-add{color:var(--sem-added)}
.tally .t-mod{color:var(--sem-moved)}
.accuracy{font-family:var(--font-mono);font-size:11px;padding:3px 8px;border-radius:3px;
  border:1px solid var(--rule-chrome);color:var(--text-chrome-dim)}
.accuracy.warn{color:var(--sem-track);border-color:color-mix(in srgb,var(--sem-track) 45%,transparent)}

/* ── 문서 헤더 (좌/우 파일 레이블) ── */
.doc-head{display:grid;grid-template-columns:1fr 46px 1fr;background:var(--surface-panel);
  border-bottom:1px solid var(--rule-chrome);flex:none}
.doc-head .side{padding:8px 14px;min-width:0}
.doc-head .side.r{border-left:1px solid var(--rule-chrome)}
.doc-head .nm{font-size:12.5px;font-weight:600;color:var(--text-chrome);
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.doc-head .meta{font-family:var(--font-mono);font-size:10.5px;color:var(--text-chrome-dim);margin-top:2px}
.doc-head .spacer{border-left:1px solid var(--rule-chrome);border-right:1px solid var(--rule-chrome)}

/* ── 본문: 문서 + 타임머신 레일 ── */
.body{display:flex;flex:1;min-height:0}
.scroll{flex:1;overflow-y:auto;overflow-x:hidden;background:var(--surface-doc);position:relative}
.grid{display:grid;grid-template-columns:1fr 46px 1fr;position:relative}

.cell{padding:9px 14px 11px;border-bottom:1px solid var(--rule-doc);min-width:0;
  background:var(--surface-doc);position:relative}
.cell.r{border-left:1px solid var(--rule-doc)}
.cell.void{background:var(--surface-doc-alt);display:flex;align-items:center;justify-content:center}
.void-mark{font-family:var(--font-mono);font-size:10.5px;color:var(--text-doc-dim);
  border:1px dashed var(--rule-doc);padding:3px 9px;letter-spacing:.04em}

.art-no{font-family:var(--font-mono);font-size:11px;font-weight:700;color:var(--text-doc-dim);
  display:inline-block;margin-right:7px}
.art-title{font-size:13px;font-weight:600;color:var(--text-doc);font-family:var(--font-ui)}
.art-text{font-family:var(--font-doc);font-size:12.5px;line-height:1.95;color:var(--text-doc);
  margin-top:5px;word-break:keep-all}
.art-text.clamp{display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;overflow:hidden}
.cell .more{font-family:var(--font-mono);font-size:9.5px;color:var(--action);margin-top:4px;
  letter-spacing:.03em}

/* 동일 구간 접기 (Diffchecker의 unchanged-lines 밴드) */
.fold{grid-column:1/-1;border-bottom:1px solid var(--rule-doc);background:var(--surface-doc-alt)}
.fold-btn{all:unset;cursor:pointer;display:flex;align-items:center;gap:9px;width:100%;
  padding:6px 14px;font-family:var(--font-mono);font-size:11px;color:var(--text-doc-dim)}
.fold-btn:hover{background:var(--surface-gutter);color:var(--action)}
.fold-btn:focus-visible{outline:2px solid var(--action);outline-offset:-2px}
.fold-btn .chev{font-size:9px;width:10px}
.fold-btn .rng{opacity:.65}

.art-text ins{background:var(--sem-added-wash);color:var(--sem-added);text-decoration:underline;
  text-decoration-thickness:1.5px;text-underline-offset:2px;font-weight:600;padding:0 1px}
.art-text del{background:var(--sem-removed-wash);color:var(--sem-removed);text-decoration:line-through;
  text-decoration-thickness:1.5px;font-weight:600;padding:0 1px}

/* 상태별 좌측 표시 (거터 기호로 전달, 셀 자체는 조용히) */
.gut{border-bottom:1px solid var(--rule-doc);background:var(--surface-gutter);
  display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
  font-family:var(--font-mono);font-size:10px;color:var(--text-doc-dim);position:relative}
.gut .sym{font-size:12px;font-weight:700;line-height:1}
.gut.s-edited .sym{color:var(--sem-moved)}
.gut.s-inserted .sym{color:var(--sem-added)}
.gut.s-deleted .sym{color:var(--sem-removed)}
.gut.s-moved .sym{color:var(--sem-moved);opacity:.65}
.gut.s-same .sym{color:var(--text-doc-dim);opacity:.35}
.gut .conf{font-size:8.5px;opacity:.6}
.gut.unverified{background:var(--sem-track-wash)}
.gut.unverified::after{content:"";position:absolute;inset:0;
  border-left:2px solid var(--sem-track);border-right:2px solid var(--sem-track)}

/* ── 트래킹 하이라이트 (좌/우 동시) ── */
.cell.is-track{background:var(--sem-track-wash);
  box-shadow:inset 0 1px 0 var(--sem-track),inset 0 -1px 0 var(--sem-track)}
.cell.void.is-track{background:var(--sem-track-wash)}
.gut.is-track{background:var(--sem-track)}
.gut.is-track .sym,.gut.is-track .conf{color:#20170a}
.gut.is-track.unverified::after{border-color:#20170a}

/* 커서 추적 자 (ruler) */
#ruler{position:absolute;left:0;right:0;height:0;border-top:1px solid var(--sem-track);
  opacity:.45;pointer-events:none;z-index:3;display:none}
#ruler.on{display:block}

/* ── 타임머신 레일 ── */
.rail{width:238px;flex:none;background:var(--surface-rail);border-left:1px solid var(--rule-chrome);
  display:flex;flex-direction:column;overflow-y:auto}
.rail-h{padding:11px 14px 8px;border-bottom:1px solid var(--rule-chrome)}
.rail-h .t{font-family:var(--font-mono);font-size:10.5px;letter-spacing:.09em;
  text-transform:uppercase;color:var(--sem-track)}
.rail-h .d{font-size:11px;color:var(--text-chrome-dim);margin-top:3px;line-height:1.5}

.tl{position:relative;padding:14px 14px 16px 30px}
.tl::before{content:"";position:absolute;left:17px;top:20px;bottom:22px;width:1px;background:var(--rule-chrome)}
.tl-node{position:relative;padding:7px 0 9px;cursor:pointer}
.tl-node::before{content:"";position:absolute;left:-17px;top:12px;width:9px;height:9px;
  border-radius:50%;background:var(--surface-rail);border:2px solid var(--text-chrome-dim);
  transition:background .15s,border-color .15s,transform .15s}
.tl-node:hover::before{border-color:var(--text-chrome)}
.tl-node.active::before{background:var(--sem-track);border-color:var(--sem-track);transform:scale(1.25)}
.tl-node .lb{font-size:12px;font-weight:600;color:var(--text-chrome-dim)}
.tl-node.active .lb{color:var(--text-chrome)}
.tl-node .mt{font-family:var(--font-mono);font-size:10px;color:var(--text-chrome-dim);margin-top:2px}
.tl-node .actor{display:inline-block;font-size:9.5px;padding:1px 5px;margin-left:5px;
  border:1px solid var(--rule-chrome);border-radius:2px;vertical-align:1px}

/* 조항 계보 (Time Machine 깊이) */
.lin{border-top:1px solid var(--rule-chrome);padding:12px 14px 18px;min-height:150px}
.lin-h{font-family:var(--font-mono);font-size:10px;letter-spacing:.08em;text-transform:uppercase;
  color:var(--text-chrome-dim);margin-bottom:9px}
.lin-empty{font-size:11.5px;color:var(--text-chrome-dim);line-height:1.6}
.lin-title{font-size:12.5px;font-weight:600;margin-bottom:9px;line-height:1.4}
.lin-step{display:flex;align-items:center;gap:8px;padding:4px 0;font-size:11px}
.lin-step .v{font-family:var(--font-mono);font-size:9.5px;color:var(--text-chrome-dim);width:26px;flex:none}
.lin-step .lbl{font-family:var(--font-mono);font-size:11px;flex:none;width:62px}
.lin-step .bar{height:3px;flex:1;background:var(--rule-chrome);position:relative;border-radius:2px}
.lin-step .bar i{position:absolute;inset:0;background:var(--action);border-radius:2px;display:block}
.lin-step.chg .lbl{color:var(--sem-moved)}
.lin-step.gone{opacity:.4}
.lin-step.gone .lbl{color:var(--sem-removed);text-decoration:line-through}
.lin-step.born .lbl{color:var(--sem-added)}

/* ── 상태바 ── */
.status{flex:none;background:var(--surface-app);border-top:1px solid var(--rule-chrome);
  padding:6px 16px;display:flex;align-items:center;gap:14px;
  font-family:var(--font-mono);font-size:11px;color:var(--text-chrome-dim);min-height:29px}
.status .live{color:var(--text-chrome)}
.status .sep{opacity:.3}
.status .src{margin-left:auto;font-family:var(--font-ui);font-size:10.5px;opacity:.65;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:44%}
@media(max-width:820px){.rail{display:none}.status .src{display:none}}
</style>

<div class="app">
  <div class="chrome">
    <div class="chrome-top">
      <div class="brand"><span class="dot"></span>diffcheck<span class="sub">조항 대조</span></div>
      <div class="rounds" id="rounds" role="tablist"></div>
      <div class="tally" id="tally"></div>
      <div class="accuracy" id="accuracy"></div>
    </div>
  </div>

  <div class="doc-head">
    <div class="side l"><div class="nm" id="hl-nm">–</div><div class="meta" id="hl-meta">–</div></div>
    <div class="spacer"></div>
    <div class="side r"><div class="nm" id="hr-nm">–</div><div class="meta" id="hr-meta">–</div></div>
  </div>

  <div class="body">
    <div class="scroll" id="scroll">
      <div id="ruler"></div>
      <div class="grid" id="grid"></div>
    </div>
    <aside class="rail">
      <div class="rail-h">
        <div class="t">Time Machine</div>
        <div class="d">협상 회차를 거슬러 올라갑니다. 조항 위에 마우스를 올리면 그 조항의 회차별 이력이 아래에 쌓입니다.</div>
      </div>
      <div class="tl" id="timeline"></div>
      <div class="lin">
        <div class="lin-h">조항 이력</div>
        <div id="lineage"><div class="lin-empty">조문 위에 마우스를 올려보세요.</div></div>
      </div>
    </aside>
  </div>

  <div class="status">
    <span id="st-live" class="live">마우스를 조문 위로 옮기면 좌·우가 동시에 추적됩니다</span>
    <span class="sep" id="st-sep"></span>
    <span id="st-detail"></span>
    <span class="src">국가법령정보센터 공개 「민간건설공사 표준도급계약서」 일반조건 · 협상 회차는 알고리즘 검증용 합성</span>
  </div>
</div>

<script>
const DATA = __DATA__;
const PAIR_KEYS = ["v0->v1","v1->v2","v2->v3","v0->v3"];
const V = Object.fromEntries(DATA.versions.map(v=>[v.id,v]));
let cur = "v0->v1", hoverRow = -1, pinRow = -1;

const SYM = {same:"=", moved:"⇅", edited:"~", inserted:"+", deleted:"−"};
const NAME = {same:"동일", moved:"번호 이동", edited:"내용 변경", inserted:"신설", deleted:"삭제"};

/* ── 라운드 탭 ── */
const roundsEl = document.getElementById("rounds");
PAIR_KEYS.forEach(k=>{
  const p = DATA.pairs[k];
  const b = document.createElement("button");
  b.className="round-tab"; b.type="button"; b.setAttribute("role","tab");
  b.textContent = `${V[p.left].short} → ${V[p.right].short}`;
  b.onclick = ()=>{ cur=k; render(); };
  b.dataset.key=k;
  roundsEl.appendChild(b);
});

/* ── 타임라인 ── */
const tlEl = document.getElementById("timeline");
DATA.versions.forEach(v=>{
  const n = document.createElement("div");
  n.className="tl-node"; n.dataset.vid=v.id;
  n.innerHTML = `<div class="lb">${v.label}<span class="actor">${v.actor}</span></div>
                 <div class="mt">${v.date} · ${v.count}개 조</div>`;
  n.onclick = ()=>{
    const i = DATA.versions.findIndex(x=>x.id===v.id);
    cur = (i===0) ? "v0->v1" : `${DATA.versions[i-1].id}->${v.id}`;
    if(!DATA.pairs[cur]) cur="v0->v3";
    render();
  };
  tlEl.appendChild(n);
});

/* ── 렌더 ── */
const grid = document.getElementById("grid");
function render(){
  const p = DATA.pairs[cur];
  document.querySelectorAll(".round-tab").forEach(b=>
    b.setAttribute("aria-selected", b.dataset.key===cur ? "true":"false"));
  document.querySelectorAll(".tl-node").forEach(n=>
    n.classList.toggle("active", n.dataset.vid===p.right || n.dataset.vid===p.left));

  const L=V[p.left], R=V[p.right];
  const $=id=>document.getElementById(id);
  $("hl-nm").textContent=L.label; $("hl-meta").textContent=`${L.date} · ${L.actor} · ${L.count}개 조`;
  $("hr-nm").textContent=R.label; $("hr-meta").textContent=`${R.date} · ${R.actor} · ${R.count}개 조`;

  const s=p.stats;
  document.getElementById("tally").innerHTML =
    `<span class="t-del">−${s.deleted||0}</span><span class="t-add">+${s.inserted||0}</span>`+
    `<span class="t-mod">~${(s.edited||0)+(s.moved||0)}</span>`;
  const ac=p.accuracy, bad=ac.total-ac.correct;
  const acEl=document.getElementById("accuracy");
  acEl.textContent = bad ? `정렬 ${ac.correct}/${ac.total} · 검수필요 ${bad}` : `정렬 ${ac.correct}/${ac.total}`;
  acEl.className = "accuracy" + (bad?" warn":"");

  renderRows();
  hoverRow=-1; setLineage(null);
}

/* 동일한 조가 3개 이상 이어지면 한 줄로 접는다 */
const FOLD_MIN=3;
let opened=new Set();
function foldGroups(rows){
  const out=[]; let run=[];
  const flush=()=>{ if(!run.length) return;
    if(run.length>=FOLD_MIN) out.push({fold:true, idx:run.slice()});
    else run.forEach(i=>out.push({fold:false, idx:i}));
    run=[]; };
  rows.forEach((r,i)=>{ if(r.status==="same") run.push(i); else { flush(); out.push({fold:false,idx:i}); } });
  flush(); return out;
}
function rowHTML(r,i){
  const verified = r.L && r.R ? (r.L.uid===r.R.uid) : true;
  const long = d => d && d.html.replace(/<[^>]+>/g,"").length > 190;
  const cell = (side,d)=> d
    ? `<div class="cell ${side}" data-row="${i}"><div><span class="art-no">${d.label}</span><span class="art-title">${d.title}</span></div>`
      + `<div class="art-text${long(d)?" clamp":""}">${d.html}</div>`
      + (long(d)?`<div class="more">클릭하면 전문</div>`:``)
      + `</div>`
    : `<div class="cell ${side} void" data-row="${i}"><span class="void-mark">${side==="r"?"삭제됨":"이 회차에 없음"}</span></div>`;
  return cell("l",r.L)
    + `<div class="gut s-${r.status}${verified?"":" unverified"}" data-row="${i}" title="${NAME[r.status]}${verified?"":" · 정렬 검수 필요"}">
         <span class="sym">${SYM[r.status]}</span>
         ${r.L&&r.R?`<span class="conf">${r.score.toFixed(2)}</span>`:""}
       </div>`
    + cell("r",r.R);
}
function renderRows(){
  const p=DATA.pairs[cur];
  grid.innerHTML = foldGroups(p.rows).map(g=>{
    if(!g.fold) return rowHTML(p.rows[g.idx], g.idx);
    const key=g.idx[0];
    if(opened.has(key)) return g.idx.map(i=>rowHTML(p.rows[i],i)).join("");
    const a=p.rows[g.idx[0]], b=p.rows[g.idx[g.idx.length-1]];
    const rng=`${(a.L||a.R).label}–${(b.L||b.R).label}`;
    return `<div class="fold"><button class="fold-btn" type="button" data-fold="${key}">
      <span class="chev">▸</span>동일한 조 ${g.idx.length}개<span class="rng">${rng}</span></button></div>`;
  }).join("");
}

function bindGrid(){
  grid.addEventListener("click",e=>{
    const f=e.target.closest("[data-fold]");
    if(f){ opened.add(+f.dataset.fold); renderRows(); return; }
    const c=e.target.closest(".cell");
    if(!c) return;
    const i=+c.dataset.row;
    grid.querySelectorAll(`.cell[data-row="${i}"] .art-text`).forEach(t=>t.classList.toggle("clamp"));
    grid.querySelectorAll(`.cell[data-row="${i}"] .more`).forEach(m=>{
      m.textContent = m.textContent==="클릭하면 전문" ? "접기" : "클릭하면 전문"; });
  });
}
bindGrid();

/* ── 마우스오버 실시간 트래킹 + 좌우 동시 하이라이트 ── */
const scroll=document.getElementById("scroll"), ruler=document.getElementById("ruler");
let raf=null, lastY=0;

/* 접힘 밴드는 자식 1개만 차지하므로 인덱스 산술 대신 data-row로 찾는다 */
function rowIndexAtY(y){
  const sr=scroll.getBoundingClientRect();
  const el=document.elementFromPoint(sr.left+24, y);
  if(!el) return -1;
  const cell=el.closest("[data-row]");
  if(!cell||cell.parentElement!==grid) return -1;
  return +cell.dataset.row;
}

function select(i){
  grid.querySelectorAll(".is-track").forEach(el=>el.classList.remove("is-track"));
  hoverRow=i;
  if(i<0){ updateStatus(null); setLineage(null); return; }
  grid.querySelectorAll(`[data-row="${i}"]`).forEach(el=>el.classList.add("is-track"));
  const r=DATA.pairs[cur].rows[i];
  updateStatus(r); setLineage(r);
}

scroll.addEventListener("mousemove",e=>{
  lastY=e.clientY;
  if(raf) return;
  raf=requestAnimationFrame(()=>{
    raf=null;
    const sr=scroll.getBoundingClientRect();
    ruler.classList.add("on");
    ruler.style.top=(lastY-sr.top+scroll.scrollTop)+"px";
    const i=rowIndexAtY(lastY);
    if(i!==hoverRow) select(i);
  });
});

scroll.addEventListener("mouseleave",()=>{
  ruler.classList.remove("on");
  grid.querySelectorAll(".is-track").forEach(el=>el.classList.remove("is-track"));
  hoverRow=-1; updateStatus(null); setLineage(null);
});

function updateStatus(r){
  const live=document.getElementById("st-live"), det=document.getElementById("st-detail"),
        sep=document.getElementById("st-sep");
  if(!r){ live.textContent="마우스를 조문 위로 옮기면 좌·우가 동시에 추적됩니다";
          det.textContent=""; sep.textContent=""; return; }
  const l=r.L?r.L.label:"—", rr=r.R?r.R.label:"—";
  live.textContent=`${l} ↔ ${rr}`;
  sep.textContent="│";
  const bits=[NAME[r.status]];
  if(r.L&&r.R){
    bits.push(`신뢰도 ${r.score.toFixed(2)}`);
    if(r.L.uid!==r.R.uid) bits.push("⚠ 정렬 검수 필요");
    const ins=(r.R.html.match(/<ins>/g)||[]).length, del=(r.L.html.match(/<del>/g)||[]).length;
    if(ins||del) bits.push(`추가 ${ins}곳 · 삭제 ${del}곳`);
  }
  det.textContent=bits.join(" · ");
}

/* ── 조항 계보 (Time Machine) ── */
function setLineage(r){
  const box=document.getElementById("lineage");
  const uid=r ? (r.L?r.L.uid:r.R.uid) : null;
  if(!uid||!DATA.lineage[uid]){
    box.innerHTML=`<div class="lin-empty">조문 위에 마우스를 올리면 그 조항이 4개 회차에서 어떻게 움직였는지 보여줍니다.</div>`;
    return;
  }
  const hist=DATA.lineage[uid];
  const title=(r.R||r.L).title;
  const lens=DATA.versions.map(v=>hist[v.id]?hist[v.id].len:0);
  const mx=Math.max(...lens,1);
  let prev=null;
  const steps=DATA.versions.map(v=>{
    const h=hist[v.id];
    let cls="", note="";
    if(!h){ cls = prev ? "gone" : "gone"; }
    else {
      if(!prev) cls="born";
      else if(prev.label!==h.label||prev.len!==h.len) cls="chg";
    }
    const row=`<div class="lin-step ${cls}">
      <span class="v">${v.short}</span>
      <span class="lbl">${h?h.label:"없음"}</span>
      <span class="bar"><i style="width:${h?Math.round(h.len/mx*100):0}%"></i></span>
    </div>`;
    if(h) prev=h;
    return row;
  }).join("");
  box.innerHTML=`<div class="lin-title">${title}</div>${steps}`;
}

render();
</script>
"""
io.open("timemachine.html","w",encoding="utf-8").write(HTML.replace("__DATA__", data))
print("ok")
