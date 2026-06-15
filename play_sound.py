import os
import platform
import subprocess
import sys


def main():
    sound_path = sys.argv[1] if len(sys.argv) > 1 else ""
    if sound_path:
        sound_path = os.path.abspath(sound_path)

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
