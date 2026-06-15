import sys
try:
    from playsound import playsound
    print("Playing sound effect...")
    # Assume a sound file is in the extension or use system sound
    # For demo, use a beep or find a file
    playsound('https://www.soundjay.com/buttons/beep-07.mp3')  # or local file
except ImportError:
    print("playsound not installed. Install with pip install playsound")
    # Fallback to print or os.system beep
    print("\a")  # Bell
except Exception as e:
    print(f"Error playing sound: {e}")