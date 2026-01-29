# FFmpeg Android Build Environment
# Produces shared libraries for arm64-v8a, armeabi-v7a, and x86_64

FROM ubuntu:22.04

ARG DEBIAN_FRONTEND=noninteractive
ARG NDK_VERSION=r26b
ARG FFMPEG_VERSION=6.1.1

# Install build dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    pkg-config \
    yasm \
    nasm \
    unzip \
    wget \
    python3 \
    && rm -rf /var/lib/apt/lists/*

# Download and setup Android NDK
RUN mkdir -p /opt/android-ndk && \
    cd /opt/android-ndk && \
    wget -q https://dl.google.com/android/repository/android-ndk-${NDK_VERSION}-linux.zip && \
    unzip -q android-ndk-${NDK_VERSION}-linux.zip && \
    rm android-ndk-${NDK_VERSION}-linux.zip && \
    mv android-ndk-${NDK_VERSION} ndk

ENV ANDROID_NDK_HOME=/opt/android-ndk/ndk
ENV PATH="${ANDROID_NDK_HOME}/toolchains/llvm/prebuilt/linux-x86_64/bin:${PATH}"

# Download FFmpeg source
RUN mkdir -p /src && cd /src && \
    wget -q https://ffmpeg.org/releases/ffmpeg-${FFMPEG_VERSION}.tar.bz2 && \
    tar xjf ffmpeg-${FFMPEG_VERSION}.tar.bz2 && \
    rm ffmpeg-${FFMPEG_VERSION}.tar.bz2 && \
    mv ffmpeg-${FFMPEG_VERSION} ffmpeg

WORKDIR /src/ffmpeg

# Copy build scripts
COPY build-ffmpeg.sh /build-ffmpeg.sh

RUN chmod +x /build-ffmpeg.sh

# Output directory
RUN mkdir -p /output

ENTRYPOINT ["/build-ffmpeg.sh"]
