{
  "targets": [
    {
      "target_name": "soundaddon",
      "sources": [ "soundaddon.cpp" ],
      "include_dirs": ["<!@(node -p \"require('node-addon-api').include\")"],
      "dependencies": ["<!(node -p \"require('node-addon-api').gyp\")"],
      "cflags!": ["-fno-exceptions"],
      "cflags_cc!": ["-fno-exceptions"],
      "conditions": [
        ["OS=='win'", {
          "libraries": ["winmm.lib"]
        }]
      ]
    }
  ]
}