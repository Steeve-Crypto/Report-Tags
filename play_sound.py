import argparse
import json
import os
import platform
import re
import subprocess
import sys


SOUND_PROFILES = {
    "tiny_win": {"label": "Tiny Win", "file": os.path.join("assets", "sounds", "tiny_win.wav")},
    "bug_fix": {"label": "Bug Fix", "file": os.path.join("assets", "sounds", "bug_fix.wav")},
    "feature_ship": {"label": "Feature Ship", "file": os.path.join("assets", "sounds", "feature_ship.wav")},
    "risky_change": {"label": "Risky Change", "file": os.path.join("assets", "sounds", "risky_change.wav")},
    "deploy_win": {"label": "Deploy Win", "file": os.path.join("assets", "sounds", "deploy_win.wav")},
    "test_green": {"label": "Test Green", "file": os.path.join("assets", "sounds", "test_green.wav")},
    "major_release": {"label": "Major Release", "file": os.path.join("assets", "sounds", "major_release.wav")},
}

RISKY_FILE_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"(^|[/\\])package(-lock)?\.json$",
        r"(^|[/\\])pnpm-lock\.yaml$",
        r"(^|[/\\])yarn\.lock$",
        r"(^|[/\\])Dockerfile$",
        r"(^|[/\\])docker-compose\.",
        r"(^|[/\\])\.github[/\\]workflows[/\\]",
        r"(^|[/\\])migrations?[/\\]",
        r"(^|[/\\])(auth|security|billing|payment|stripe|database|db)[/\\]",
        r"(^|[/\\]).*\.sql$",
    ]
]

TEST_FILE_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"(^|[/\\])(__tests__|tests?|spec)[/\\]",
        r"\.(test|spec)\.[jt]sx?$",
        r"\.(test|spec)\.py$",
    ]
]


def main():
    args = parse_args()
    analysis = analyze(args)
    sound_path = choose_sound_path(args, analysis["profile"])
    if not args.no_play:
        play_sound(sound_path)
    print(json.dumps(analysis), flush=True)


def parse_args():
    parser = argparse.ArgumentParser(description="Git Sound Report adaptive audio engine")
    parser.add_argument("--event", default="git_success")
    parser.add_argument("--command", default="")
    parser.add_argument("--workspace", default="")
    parser.add_argument("--extension-dir", default=os.path.dirname(os.path.abspath(__file__)))
    parser.add_argument("--sound-path", default="")
    parser.add_argument("--intelligent", default="true")
    parser.add_argument("--no-play", action="store_true", help="Classify and print JSON without playing audio")
    return parser.parse_args()


def analyze(args):
    if str(args.intelligent).lower() not in {"1", "true", "yes", "on"}:
        return build_analysis("feature_ship", "success", "low", "small", {}, [], {"files_changed": 0, "insertions": 0, "deletions": 0})

    message = get_last_commit_message(args.workspace)
    stats = get_last_commit_stats(args.workspace)
    files = get_changed_files(args.workspace, args.event)
    return classify_event(args.event, args.command, message, files, stats)


def classify_event(event_name, command, message, files, stats):
    text = f"{command} {message}".lower()
    insights = inspect_files(files)
    intent = infer_intent(text, event_name, insights)
    risk = infer_risk(text, stats, insights)
    scale = infer_scale(stats, len(files))
    profile = choose_profile(event_name, intent, risk, scale, insights, text)
    return build_analysis(profile, intent, risk, scale, insights, files, stats)


def build_analysis(profile, intent, risk, scale, insights, files, stats):
    selected = SOUND_PROFILES.get(profile, SOUND_PROFILES["feature_ship"])
    return {
        "profile": profile,
        "profileLabel": selected["label"],
        "intent": intent,
        "risk": risk,
        "scale": scale,
        "fileCount": len(files),
        "filesChanged": int(stats.get("files_changed", 0)),
        "insertions": int(stats.get("insertions", 0)),
        "deletions": int(stats.get("deletions", 0)),
        "riskyFileCount": int(insights.get("risky_file_count", 0)),
        "testFileCount": int(insights.get("test_file_count", 0)),
        "hasDependencyChange": bool(insights.get("has_dependency_change", False)),
        "hasCiChange": bool(insights.get("has_ci_change", False)),
    }


def inspect_files(files):
    risky_file_count = 0
    test_file_count = 0
    has_dependency_change = False
    has_ci_change = False

    for file_name in files:
        normalized = file_name.replace(os.sep, "/")
        if any(pattern.search(normalized) for pattern in RISKY_FILE_PATTERNS):
            risky_file_count += 1
        if any(pattern.search(normalized) for pattern in TEST_FILE_PATTERNS):
            test_file_count += 1
        if re.search(r"package(-lock)?\.json$|pnpm-lock\.yaml$|yarn\.lock$", normalized, re.IGNORECASE):
            has_dependency_change = True
        if re.search(r"\.github[/\\]workflows[/\\]|azure-pipelines|circleci|gitlab-ci", normalized, re.IGNORECASE):
            has_ci_change = True

    return {
        "risky_file_count": risky_file_count,
        "test_file_count": test_file_count,
        "has_dependency_change": has_dependency_change,
        "has_ci_change": has_ci_change,
    }


def infer_intent(text, event_name, insights):
    if re.search(r"\b(revert|rollback|backout)\b", text):
        return "recovery"
    if re.search(r"\b(hotfix|urgent|prod|production|incident)\b", text):
        return "hotfix"
    if re.search(r"\b(deploy|release|ship|publish|launch)\b", text) or event_name == "push":
        return "deploy"
    if re.search(r"\b(fix|bug|patch|repair|resolve)\b", text):
        return "fix"
    if re.search(r"\b(feat|feature|add|new|initial)\b", text):
        return "feature"
    if re.search(r"\b(refactor|cleanup|rework|rewrite)\b", text):
        return "refactor"
    if re.search(r"\b(perf|performance|optimi[sz]e|speed)\b", text):
        return "performance"
    if re.search(r"\b(test|spec|coverage)\b", text) or insights["test_file_count"] > 0:
        return "test"
    if re.search(r"\b(doc|docs|readme|comment)\b", text):
        return "docs"
    return event_name


def infer_risk(text, stats, insights):
    score = 0
    if re.search(r"\b(auth|security|payment|billing|stripe|database|migration|prod|production|hotfix|incident)\b", text):
        score += 3
    if insights["risky_file_count"] > 0:
        score += 2
    if insights["has_dependency_change"]:
        score += 1
    if stats.get("files_changed", 0) >= 12:
        score += 1
    if stats.get("insertions", 0) + stats.get("deletions", 0) >= 500:
        score += 1
    if score >= 4:
        return "high"
    if score >= 2:
        return "medium"
    return "low"


def infer_scale(stats, fallback_file_count):
    files_changed = stats.get("files_changed", 0) or fallback_file_count
    churn = stats.get("insertions", 0) + stats.get("deletions", 0)
    if files_changed >= 20 or churn >= 1000:
        return "major"
    if files_changed >= 6 or churn >= 200:
        return "medium"
    return "small"


def choose_profile(event_name, intent, risk, scale, insights, text):
    if risk == "high":
        return "risky_change"
    if intent in {"recovery", "hotfix"}:
        return "bug_fix"
    if intent == "deploy":
        return "major_release" if scale == "major" or re.search(r"\b(release|launch)\b", text) else "deploy_win"
    if intent == "test" or insights["test_file_count"] > 0:
        return "test_green"
    if intent == "fix":
        return "bug_fix"
    if intent == "feature":
        return "major_release" if scale == "major" else "feature_ship"
    if intent == "performance":
        return "feature_ship"
    if scale == "major":
        return "major_release"
    if event_name == "add" or intent == "docs":
        return "tiny_win"
    return "feature_ship"


def get_last_commit_message(workspace):
    return run_git(workspace, ["log", "-1", "--pretty=%B"])


def get_last_commit_stats(workspace):
    output = run_git(workspace, ["show", "--shortstat", "--format=", "HEAD"])
    stats = {"files_changed": 0, "insertions": 0, "deletions": 0}
    files_match = re.search(r"(\d+)\s+files?\s+changed", output)
    insertions_match = re.search(r"(\d+)\s+insertions?\(\+\)", output)
    deletions_match = re.search(r"(\d+)\s+deletions?\(-\)", output)
    if files_match:
        stats["files_changed"] = int(files_match.group(1))
    if insertions_match:
        stats["insertions"] = int(insertions_match.group(1))
    if deletions_match:
        stats["deletions"] = int(deletions_match.group(1))
    return stats


def get_changed_files(workspace, event_name):
    if event_name in {"commit", "push"}:
        output = run_git(workspace, ["show", "--name-only", "--format=", "HEAD"])
    else:
        output = run_git(workspace, ["diff", "--name-only", "--cached"])
    return [line.strip() for line in output.splitlines() if line.strip()]


def run_git(workspace, args):
    if not workspace or not os.path.isdir(workspace):
        return ""
    try:
        result = subprocess.run(
            ["git", *args],
            cwd=workspace,
            capture_output=True,
            text=True,
            timeout=2.5,
            check=False,
        )
        return result.stdout if result.returncode == 0 else ""
    except Exception:
        return ""


def choose_sound_path(args, profile):
    if args.sound_path and os.path.exists(args.sound_path):
        return os.path.abspath(args.sound_path)
    selected = SOUND_PROFILES.get(profile, SOUND_PROFILES["feature_ship"])
    profile_path = os.path.join(args.extension_dir, selected["file"])
    if os.path.exists(profile_path):
        return profile_path
    fallback = os.path.join(args.extension_dir, "assets", "report_tag_success.wav")
    return fallback if os.path.exists(fallback) else ""


def play_sound(sound_path):
    if sound_path and os.path.exists(sound_path):
        if play_with_playsound(sound_path):
            return
        if play_with_platform_player(sound_path):
            return
    play_fallback_beep()


def play_with_playsound(sound_path):
    try:
        from playsound import playsound

        playsound(sound_path, block=False)
        return True
    except Exception:
        return False


def play_with_platform_player(sound_path):
    system = platform.system()
    try:
        if system == "Windows":
            import winsound

            if sound_path.lower().endswith(".wav"):
                winsound.PlaySound(sound_path, winsound.SND_FILENAME | winsound.SND_ASYNC)
                return True
            return False
        if system == "Darwin":
            subprocess.Popen(["afplay", sound_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
            return True
        subprocess.Popen(["aplay", sound_path], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False


def play_fallback_beep():
    try:
        if platform.system() == "Windows":
            import winsound

            winsound.MessageBeep(winsound.MB_ICONASTERISK)
            return
    except Exception:
        pass
    print("\a", end="", flush=True)


if __name__ == "__main__":
    main()
