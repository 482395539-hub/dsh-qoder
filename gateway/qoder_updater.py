# -*- coding: utf-8 -*-
"""一键更新（面板「一键更新」按钮）。

设计约束（这是**改自己代码**的操作，宁可失败也不能半更新）：

1. 来源固定：只从 GitHub 官方 release 的源码 tarball 拉取，不接受任意 URL。
2. 先校验后落盘：解压到临时目录 -> 逐个 compile 校验 -> 读 VERSION 必须等于目标
   tag -> 才开始替换。
3. 先备份后替换：本次会被覆盖的每个文件都先复制到 backups/update-<from>-<ts>/；
   任何一步失败就从备份回滚。
4. 不碰数据：accounts/、python/ 运行时、backups/、.git/、日志/PID 一律跳过。
5. 容器不自杀：Docker 里替换代码没有意义（镜像重建会覆盖），直接给指令。
6. 单飞：同一时刻只允许一个更新任务。
"""
import io
import json
import os
import shutil
import subprocess
import sys
import tarfile
import tempfile
import threading
import time
import urllib.request

REPO = "shuishuipingan/qoder2api-hub"
TARBALL_URL = "https://github.com/%s/archive/refs/tags/%s.tar.gz" % (REPO, "%s")

PROTECTED_TOP = {
    ".git", "accounts", "backups", "python", "_acc", "node_modules",
    ".venv", "venv", "__pycache__", ".idea", ".vscode",
}

COPY_SUFFIXES = (".py", ".html", ".md", ".json", ".bat", ".sh", ".txt",
                 ".yml", ".yaml", ".cfg", ".toml", ".ini", ".css", ".js")

_LOCK = threading.Lock()
_STATE = {"running": False, "last": None}


def _log(msg, level="INFO"):
    try:
        print("[updater] %s %s" % (level, msg), flush=True)
    except Exception:
        pass


def _version_tuple(value):
    out = []
    for chunk in str(value or "").lstrip("vV").split("."):
        digits = ""
        for ch in chunk:
            if ch.isdigit():
                digits += ch
            else:
                break
        out.append(int(digits or 0))
    while len(out) < 3:
        out.append(0)
    return tuple(out[:3])


def _in_container():
    try:
        if os.path.exists("/.dockerenv"):
            return True
        with open("/proc/1/cgroup", encoding="utf-8", errors="ignore") as fh:
            blob = fh.read()
        return ("docker" in blob) or ("containerd" in blob) or ("kubepods" in blob)
    except Exception:
        return False


def latest_release(timeout=8):
    """读 GitHub 最新 release（tag / 页面地址 / tarball 地址）。"""
    url = "https://api.github.com/repos/%s/releases/latest" % REPO
    req = urllib.request.Request(url, headers={
        "Accept": "application/vnd.github+json",
        "User-Agent": "qoder-proxy-updater",
    })
    with urllib.request.urlopen(req, timeout=timeout) as resp:
        data = json.loads(resp.read().decode("utf-8"))
    tag = str(data.get("tag_name") or "").strip()
    if not tag:
        raise RuntimeError("latest release has no tag_name")
    return {"tag": tag, "version": tag.lstrip("vV"),
            "url": str(data.get("html_url") or ""),
            "tarball": TARBALL_URL % tag}


def _download(url, dest, timeout=120):
    req = urllib.request.Request(url, headers={"User-Agent": "qoder-proxy-updater"})
    with urllib.request.urlopen(req, timeout=timeout) as resp, open(dest, "wb") as fh:
        shutil.copyfileobj(resp, fh)
    return dest


def _safe_members(tar):
    out = []
    for m in tar.getmembers():
        name = m.name.replace("\\", "/")
        if name.startswith("/") or ".." in name.split("/"):
            continue
        out.append((m, name))
    return out


def _extract(tarball, dest):
    """解压到 dest，返回 release 根目录（tarball 顶层目录）。"""
    with tarfile.open(tarball, "r:*") as tar:
        members = _safe_members(tar)
        if not members:
            raise RuntimeError("empty or unsafe tarball")
        roots = {n.split("/")[0] for _m, n in members}
        if len(roots) != 1:
            raise RuntimeError("unexpected tarball layout: %s" % sorted(roots))
        root = roots.pop()
        # 只解压**过滤后**的成员（extractall 默认会解压全部，等于绕过过滤）
        tar.extractall(dest, members=[m for m, _n in members])
    return os.path.join(dest, root)


def _read_version(path):
    try:
        with io.open(path, encoding="utf-8") as fh:
            for line in fh:
                line = line.strip()
                if line.startswith("VERSION") and "=" in line:
                    return line.split("=", 1)[1].strip().strip(chr(34) + chr(39))
    except Exception:
        return ""
    return ""


def plan_update(release_root, root=None):
    """列出会被替换的文件（相对路径），跳过保护路径与非代码文件。"""
    out = []
    for dirpath, dirnames, filenames in os.walk(release_root):
        dirnames[:] = [d for d in dirnames if d not in PROTECTED_TOP
                       and not d.startswith(".tmp")]
        for name in filenames:
            if name.startswith(".tmp"):
                continue
            full = os.path.join(dirpath, name)
            rel = os.path.relpath(full, release_root).replace("\\", "/")
            if rel.split("/")[0] in PROTECTED_TOP:
                continue
            if not name.lower().endswith(COPY_SUFFIXES):
                continue
            out.append(rel)
    return sorted(out)


def _verify_release(release_root, tag):
    """解压后的 release 必须能编译、且 VERSION 与 tag 一致。"""
    main = os.path.join(release_root, "qoder_proxy.py")
    if not os.path.isfile(main):
        return "release has no qoder_proxy.py"
    want = str(tag or "").lstrip("vV")
    got = _read_version(main)
    if not got:
        return "cannot read VERSION from release"
    if _version_tuple(got) != _version_tuple(want):
        return "version mismatch: release=%s tag=%s" % (got, want)
    bad = []
    for dirpath, dirnames, filenames in os.walk(release_root):
        dirnames[:] = [d for d in dirnames if d not in PROTECTED_TOP]
        for name in filenames:
            if not name.endswith(".py"):
                continue
            full = os.path.join(dirpath, name)
            try:
                with io.open(full, encoding="utf-8") as fh:
                    compile(fh.read(), full, "exec")
            except Exception as exc:
                bad.append("%s: %s" % (os.path.relpath(full, release_root),
                                       str(exc)[:80]))
    if bad:
        return "release has broken python files: " + "; ".join(bad[:3])
    return ""


def apply_update(root, tag=None, progress=None):
    """下载 -> 校验 -> 备份 -> 替换。返回 {ok, from, to, files, backup, error}。"""
    say = progress or (lambda *a, **k: None)
    if _in_container() and not os.environ.get("QD_UPDATE_ALLOW_CONTAINER"):
        return {"ok": False, "error":
                "运行在容器里：镜像重建会覆盖本地改动，请在宿主机执行 "
                "docker compose pull && docker compose up -d"}
    with _LOCK:
        if _STATE["running"]:
            return {"ok": False, "error": "another update is already running"}
        _STATE["running"] = True
    tmp = tempfile.mkdtemp(prefix="qd-update-")
    backup = ""
    replaced = []
    try:
        rel = latest_release()
        if tag and str(tag).lstrip("vV") != rel["version"]:
            rel = dict(rel, tag=tag, version=str(tag).lstrip("vV"),
                       tarball=TARBALL_URL % tag)
        cur = _read_version(os.path.join(root, "qoder_proxy.py"))
        if _version_tuple(cur) >= _version_tuple(rel["version"]):
            return {"ok": True, "from": cur, "to": rel["version"],
                    "files": [], "backup": "", "noop": True,
                    "message": "already up to date"}
        say("downloading %s" % rel["tarball"])
        tar_path = _download(rel["tarball"], os.path.join(tmp, "rel.tar.gz"))
        say("extracting")
        release_root = _extract(tar_path, os.path.join(tmp, "x"))
        say("verifying")
        err = _verify_release(release_root, rel["version"])
        if err:
            return {"ok": False, "error": err}
        files = plan_update(release_root, root)
        if not files:
            return {"ok": False, "error": "release contains no updatable files"}
        stamp = time.strftime("%Y%m%d-%H%M%S")
        backup = os.path.join(root, "backups",
                              "update-%s-%s" % (cur or "unknown", stamp))
        say("backing up %d files -> %s" % (len(files), backup))
        for rel_path in files:
            src_old = os.path.join(root, rel_path)
            if not os.path.isfile(src_old):
                continue
            dst = os.path.join(backup, rel_path)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            shutil.copy2(src_old, dst)
        say("replacing")
        for rel_path in files:
            src = os.path.join(release_root, rel_path)
            dst = os.path.join(root, rel_path)
            os.makedirs(os.path.dirname(dst), exist_ok=True)
            replaced.append(rel_path)
            shutil.copy2(src, dst)
        new_ver = _read_version(os.path.join(root, "qoder_proxy.py"))
        if _version_tuple(new_ver) != _version_tuple(rel["version"]):
            raise RuntimeError("post-update version mismatch: %s" % new_ver)
        _STATE["last"] = {"at": time.time(), "from": cur, "to": new_ver,
                          "files": len(files), "backup": backup}
        return {"ok": True, "from": cur, "to": new_ver, "files": files,
                "backup": backup}
    except Exception as exc:
        _log("update failed: %s" % exc, level="ERROR")
        if replaced and backup and os.path.isdir(backup):
            say("rolling back %d files" % len(replaced))
            for rel_path in replaced:
                src = os.path.join(backup, rel_path)
                if os.path.isfile(src):
                    try:
                        shutil.copy2(src, os.path.join(root, rel_path))
                    except Exception:
                        pass
        return {"ok": False, "error": str(exc)[:300],
                "rolled_back": bool(replaced and backup)}
    finally:
        with _LOCK:
            _STATE["running"] = False
        shutil.rmtree(tmp, ignore_errors=True)


def schedule_restart(argv, delay=1.2):
    """延迟重启自己：起一个新进程（同一 argv/cwd），然后退出当前进程。"""
    args = [sys.executable]
    for item in (argv or []):
        args.append(item)
    if len(args) < 2:
        return False

    def _run():
        time.sleep(delay)
        try:
            subprocess.Popen(args, cwd=os.getcwd(), close_fds=True)
        except Exception as exc:
            _log("restart failed: %s" % exc, level="ERROR")
            return
        os._exit(0)

    threading.Thread(target=_run, daemon=True).start()
    return True


def state():
    return {"running": _STATE["running"], "last": _STATE["last"]}