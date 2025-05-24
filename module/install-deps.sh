#!/bin/bash

echo "Installing system dependencies for Playwright..."

sudo apt update && sudo apt install -y \
  libgtk-4-1 \
  libgraphene-1.0-0 \
  libwoff1 \
  libvpx9 \
  libopus0 \
  libgstreamer1.0-0 \
  libgstreamer-plugins-base1.0-0 \
  libgstreamer-plugins-good1.0-0 \
  libflite1 \
  libwebpdemux2 \
  libavif16 \
  libharfbuzz-icu0 \
  libwebpmux3 \
  libenchant-2-2 \
  libsecret-1-0 \
  libhyphen0 \
  libmanette-0.2-0 \

echo "All dependencies installed. You can now run Playwright."
