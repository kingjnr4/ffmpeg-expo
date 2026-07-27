#ifndef EXPO_FFMPEG_H
#define EXPO_FFMPEG_H

#ifdef __cplusplus
extern "C" {
#endif

typedef int (*expo_ffmpeg_cancel_callback)(void *opaque);

/* argv follows main(3) conventions. The callback may be NULL. */
int expo_ffmpeg_execute(int argc, char **argv,
                        expo_ffmpeg_cancel_callback cancel_callback,
                        void *cancel_opaque);

#ifdef __cplusplus
}
#endif

#endif
