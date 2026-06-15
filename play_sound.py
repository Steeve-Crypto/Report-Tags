import sys
try:
    from playsound import playsound
    print("🎵 Playing report tag success sound...")
    # Update this path to your .mp3/.wav file
    playsound('report_tag_success.mp3')  # Place sound file in extension folder
except ImportError:
    print("⚠️  Install playsound: pip install playsound")
    print("\a")  # Fallback system bell
except Exception as e:
    print(f"Sound playback error: {e}")
    print("\a")
