# 打包临时归档（2026-11-22）

从项目根目录移入，未删除。这些是 2026-05 底手工打包上传前端时的临时产物，已被统一发布流程（`运维\流水线\通苏嘉甬-发布.ps1` → 服务器 `/opt/deploy/发布.sh`）取代。

| 文件 | 说明 |
|---|---|
| `frontend_proper.tar.gz`（964 KB） | 手工打包的完整前端，当时上传用 |
| `frontend_slim.zip`（1 MB） | 精简版打包 |
| `frontend_slim.tar.gz`（29 B） | 空包，打包失败的产物 |
| `_check/_chk/_chk2/_diag/_fix/_fix2/_fix3/_init/_sync/gen.py` | 一次性排查/修补脚本，对应问题均已结案 |

注意：`patch_specialized.py`、`patch_summary.py`、两个 `nginx_default_*.conf` 仍在根目录，属于有内容的正式文件，未归档。
