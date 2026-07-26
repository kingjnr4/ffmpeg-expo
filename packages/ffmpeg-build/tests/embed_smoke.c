#include "expo_ffmpeg.h"

#include <stdio.h>

static int run_command(int argc, char **argv)
{
    fprintf(stderr, "running embedded command: %s\n", argv[1]);
    int result = expo_ffmpeg_execute(argc, argv, NULL, NULL);
    fprintf(stderr, "embedded command finished: %s (%d)\n", argv[1], result);
    if (result != 0)
        fprintf(stderr, "embedded FFmpeg returned %d\n", result);
    return result;
}

int main(int argc, char **argv)
{
    char *version[] = { "ffmpeg", "-version" };
    char *transcode[] = {
        "ffmpeg", "-loglevel", "error", "-y", "-i", NULL, "-map", "0:v:0",
        "-vf", "scale=32:32", "-c:v", "mpeg4", NULL
    };
    char *invalid[] = { "ffmpeg", "-definitely-not-an-option" };

    if (argc != 3) {
        fprintf(stderr, "usage: %s INPUT OUTPUT\n", argv[0]);
        return 2;
    }
    transcode[5] = argv[1];
    transcode[12] = argv[2];

    if (run_command(13, transcode) != 0)
        return 1;
    if (run_command(2, invalid) == 0)
        return 1;
    if (run_command(2, version) != 0)
        return 1;
    if (run_command(13, transcode) != 0)
        return 1;

    return 0;
}
