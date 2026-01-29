cmake_minimum_required(VERSION 3.22)
project(ffmpeg-jni)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# Find required packages
find_library(log-lib log)

# FFmpeg library paths
set(FFMPEG_LIB_DIR ${CMAKE_SOURCE_DIR}/jniLibs/${ANDROID_ABI})

# Add FFmpeg shared libraries
add_library(avcodec SHARED IMPORTED)
set_target_properties(avcodec PROPERTIES IMPORTED_LOCATION ${FFMPEG_LIB_DIR}/libavcodec.so)

add_library(avformat SHARED IMPORTED)
set_target_properties(avformat PROPERTIES IMPORTED_LOCATION ${FFMPEG_LIB_DIR}/libavformat.so)

add_library(avutil SHARED IMPORTED)
set_target_properties(avutil PROPERTIES IMPORTED_LOCATION ${FFMPEG_LIB_DIR}/libavutil.so)

add_library(swresample SHARED IMPORTED)
set_target_properties(swresample PROPERTIES IMPORTED_LOCATION ${FFMPEG_LIB_DIR}/libswresample.so)

add_library(swscale SHARED IMPORTED)
set_target_properties(swscale PROPERTIES IMPORTED_LOCATION ${FFMPEG_LIB_DIR}/libswscale.so)

# Include directories for FFmpeg headers
include_directories(${CMAKE_SOURCE_DIR}/include)

# Build our JNI wrapper
add_library(ffmpeg-jni SHARED
    src/main/cpp/ffmpeg_jni.cpp
    src/main/cpp/ffmpeg_session.cpp
    src/main/cpp/ffmpeg_progress.cpp
)

# Link libraries
target_link_libraries(ffmpeg-jni
    ${log-lib}
    avcodec
    avformat
    avutil
    swresample
    swscale
)

# Set library output name
set_target_properties(ffmpeg-jni PROPERTIES
    LIBRARY_OUTPUT_NAME "ffmpeg-jni"
)
