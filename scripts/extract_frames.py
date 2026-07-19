import av, os
os.makedirs("frames", exist_ok=True)
container = av.open("input_video.mov")
stream = container.streams.video[0]
duration = float(stream.duration * stream.time_base) if stream.duration else float(container.duration/1000000)
print(f"DURATION_SEC={duration:.1f}")
print(f"FPS={float(stream.average_rate):.2f}  SIZE={stream.width}x{stream.height}")

# 均匀抽 8 帧
n = 8
targets = [duration * i/(n+1) for i in range(1, n+1)]
container.seek(0)
grabbed = []
ti = 0
for frame in container.decode(video=0):
    t = float(frame.pts * stream.time_base)
    if ti < len(targets) and t >= targets[ti]:
        fn = f"frames/frame_{ti:02d}_{int(t)}s.jpg"
        frame.to_image().save(fn, quality=80)
        grabbed.append((int(t), fn))
        ti += 1
        if ti >= len(targets):
            break
for t, fn in grabbed:
    print(f"{t:>4}s  {fn}")
