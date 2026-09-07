#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""versions.json(도급 4회차) + sintak.json(신탁 본문↔특약)을 sets.json으로 합친다."""
import io, json, os

HERE = os.path.dirname(os.path.abspath(__file__))


def r(name):
    return json.load(io.open(os.path.join(HERE, name), encoding="utf-8"))


def main():
    v = r("versions.json")
    s = r("sintak.json")
    sets = [
        {"id": "dogeup", "name": "공사도급계약서 · 협상 4회차", "mode": "version",
         "source": v["source"], "versions": v["versions"]},
        {"id": s["id"], "name": s["name"], "mode": s["mode"],
         "source": s["source"], "versions": s["versions"]},
    ]
    out = {"sets": sets}
    io.open(os.path.join(HERE, "sets.json"), "w", encoding="utf-8").write(
        json.dumps(out, ensure_ascii=False))
    for x in sets:
        print(f"  {x['id']:8s} {x['mode']:9s} {len(x['versions'])}개 문서 · "
              f"{' / '.join(str(len(d['articles'])) + '조' for d in x['versions'])}")


if __name__ == "__main__":
    main()
