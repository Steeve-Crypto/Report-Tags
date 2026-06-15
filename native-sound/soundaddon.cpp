#include <napi.h>
#ifdef _WIN32
#include <windows.h>
#include <mmsystem.h>
#pragma comment(lib, "winmm.lib")
#elif __APPLE__
#include <AppKit/NSSound.h>
#else
// Linux placeholder - use libcanberra or similar in production
#include <stdio.h>
#endif

Napi::Value PlayReportTag(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  
#ifdef _WIN32
  PlaySound(TEXT("report_tag_success.wav"), NULL, SND_FILENAME | SND_ASYNC);
#elif __APPLE__
  // macOS example
  system("afplay report_tag_success.mp3 &");
#else
  // Linux
  system("aplay report_tag_success.wav &");
#endif
  
  return Napi::Boolean::New(env, true);
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("playReportTag", Napi::Function::New(env, PlayReportTag));
  return exports;
}

NODE_API_MODULE(soundaddon, Init)