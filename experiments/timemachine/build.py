#!/usr/bin/env python3
"""src/ 조각과 versions.json을 단일 HTML로 묶는다.  실행: python3 build.py"""
import io, os
here = os.path.dirname(os.path.abspath(__file__))
def r(p): return io.open(os.path.join(here, p), encoding="utf-8").read()
out = (r("src/head.html")
       + "<style>\n" + r("src/app.css") + "</style>\n"
       + r("src/body.html") + "\n"
       + '<script src="https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js"></script>\n'
       + "<script>\n" + r("src/app.js").replace("__DATA__", r("versions.json"), 1) + "\n</script>\n")
io.open(os.path.join(here, "timemachine.html"), "w", encoding="utf-8").write(out)
print("timemachine.html", len(out), "chars")
