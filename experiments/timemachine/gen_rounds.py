# -*- coding: utf-8 -*-
"""실제 표준계약서 43개 조(articles_full.tsv) 위에 협상 4회차를 합성해 versions.json을 만든다.

조항마다 uid를 심어두므로, 정렬 결과의 좌우 uid가 일치하는지로 정확도를 잴 수 있다.
그 검증은 src/aligner.reference.js 가 담당한다 — 여기서 또 정렬하지 않는다."""
import re, io, json

# ── 실물 조문 로드 ──────────────────────────────────────────────
base = []
for line in io.open("articles_full.tsv", encoding="utf-8").read().strip().split("\n"):
    n, title, text = line.split("\t", 2)
    base.append({"uid": f"a{len(base)+1}", "title": title, "text": text})
BASE = {a["uid"]: a for a in base}

# ── 라운드 정의 ────────────────────────────────────────────────
# order: uid 목록 / edits: uid -> {title?, text 변환 함수}
def sub(pat, rep):
    return lambda t: re.sub(pat, rep, t, count=1)
def append(s):
    return lambda t: t + " " + s

NEW_PRICE = "n_price"      # 신설: 물가변동 특례
NEW_LD    = "n_ld"         # 신설: 품질미이행 손해배상 예정액
EXTRA = {
  NEW_PRICE: {"uid": NEW_PRICE, "title": "물가변동 특례", "text": ""},
  NEW_LD:    {"uid": NEW_LD, "title": "품질미이행 손해배상 예정액", "text": ""},
}

v0_order = [a["uid"] for a in base]

# v1 시공사 1차 제출: 물가변동 특례 신설(임계치 없음), 손해의 부담(a25) 삭제, 조번호 밀림
v1_order = []
for u in v0_order:
    if u == "a25":            # 손해의 부담 삭제
        continue
    v1_order.append(u)
    if u == "a10":            # 제10조 뒤 신설
        v1_order.append(NEW_PRICE)

v1_edits = {
  NEW_PRICE: {"text": "① \"도급인\"과 \"수급인\"은 착공 이후 발생하는 물가변동에 대하여는 계약금액을 조정하지 아니한다. ② 제1항에도 불구하고 부득이한 사정이 있는 경우 양 당사자가 협의하여 정한다."},
  "a22": {"text": sub(r"$", " 다만, 착공 이후에는 제1항에 따른 조정을 하지 아니한다.")},
  "a23": {"text": sub(r"100분의 10", "100분의 20")},   # 원자재 연동 기준 완화
  "a18": {"title": "부적합한 공사 등", "text": sub(r"하여야 한다", "할 수 있다")},
}

# v2 발주처 검토 반영: 객관적 임계치 삽입, 손해의 부담 복원, 기준비율 환원, 의무조항 복원
v2_order = []
for u in v1_order:
    v2_order.append(u)
    if u == "a24":            # 기성부분금 뒤에 손해의 부담 복원
        v2_order.append("a25")
v2_edits = {
  NEW_PRICE: {"text": "① \"도급인\"과 \"수급인\"은 착공 이후 발생하는 물가변동에 대하여는 계약금액을 조정하지 아니함을 원칙으로 한다. ② 제1항에도 불구하고 한국건설기술연구원이 공표하는 건설공사비지수의 누적변동률이 계약체결일 대비 100분의 15를 초과하는 경우에는 그 초과분에 한하여 조정할 수 있다."},
  "a22": {"text": sub(r" 다만, 착공 이후에는 제1항에 따른 조정을 하지 아니한다\.", "")},
  "a23": {"text": sub(r"100분의 20", "100분의 15")},
  "a18": {"title": "부적합한 공사 등", "text": sub(r"할 수 있다", "하여야 한다")},
}

# v3 최종 합의: 임계치 12%로 강화, 품질미이행 LD 신설
v3_order = list(v2_order) + [NEW_LD]
v3_edits = {
  NEW_PRICE: {"text": sub(r"100분의 15", "100분의 12")},
  NEW_LD: {"text": "① \"수급인\"이 품질사양서에 정한 자재·공법을 이행하지 아니한 경우 \"도급인\"은 해당 부분 계약금액의 1000분의 5에 상당하는 금액을 손해배상 예정액으로 청구할 수 있다. ② 제1항의 청구는 채무불이행 및 하자담보책임과 별도로 행사할 수 있다."},
}

ROUNDS = [
  {"id":"v0","label":"표준계약서 원안","short":"원안","date":"2026-01-15","actor":"발주처","order":v0_order,"edits":{}},
  {"id":"v1","label":"시공사 1차 제출","short":"1차","date":"2026-02-03","actor":"시공사","order":v1_order,"edits":v1_edits},
  {"id":"v2","label":"발주처 검토 반영","short":"2차","date":"2026-02-21","actor":"발주처","order":v2_order,"edits":v2_edits},
  {"id":"v3","label":"최종 합의본","short":"최종","date":"2026-03-10","actor":"합의","order":v3_order,"edits":v3_edits},
]

# ── 버전별 조문 확정 (편집 누적 적용) ──────────────────────────
state = {u: dict(BASE[u]) if u in BASE else dict(EXTRA[u]) for u in set(v3_order) | set(v0_order)}
versions = []
for r in ROUNDS:
    for uid, e in r["edits"].items():
        if uid not in state:
            state[uid] = dict(EXTRA[uid])
        if "title" in e:
            state[uid]["title"] = e["title"]
        if "text" in e:
            t = e["text"]
            state[uid]["text"] = t(state[uid]["text"]) if callable(t) else t
    arts, num = [], 0
    for u in r["order"]:
        s = state[u]
        if u == NEW_PRICE:                       # 제N조의2 형식
            label = f"제{num}조의2"
        else:
            num += 1
            label = f"제{num}조"
        arts.append({"uid": u, "label": label, "title": s["title"], "text": s["text"]})
    versions.append({**{k: r[k] for k in ("id","label","short","date","actor")}, "articles": arts})

# ── 출력: 조문 원문만 담는다 ─────────────────────────────────
# 정렬·diff·계보는 전부 브라우저에서 계산하므로 미리 구운 결과를 싣지 않는다.
out = {
    "source": "국가법령정보센터 공개 「민간건설공사 표준도급계약서」 일반조건",
    "versions": versions,
}
io.open("versions.json", "w", encoding="utf-8").write(json.dumps(out, ensure_ascii=False))
print("→ versions.json", [(v["id"], len(v["articles"])) for v in versions])
