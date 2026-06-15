#include <napi.h>
#include <string>

#ifdef _WIN32
#include <mmsystem.h>
#include <windows.h>
#pragma comment(lib, "winmm.lib")
#endif

Napi::Value PlayReportTag(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();

#ifdef _WIN32
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "Expected a WAV file path").ThrowAsJavaScriptException();
    return env.Null();
  }

  std::u16string path = info[0].As<Napi::String>().Utf16Value();
  BOOL ok = PlaySoundW(
      reinterpret_cast<LPCWSTR>(path.c_str()),
      NULL,
      SND_FILENAME | SND_ASYNC | SND_NODEFAULT);

  return Napi::Boolean::New(env, ok == TRUE);
#else
  Napi::Error::New(env, "Native addon prototype currently supports Windows WAV playback only")
      .ThrowAsJavaScriptException();
  return env.Null();
#endif
}

Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("playReportTag", Napi::Function::New(env, PlayReportTag));
  return exports;
}

NODE_API_MODULE(soundaddon, Init)
