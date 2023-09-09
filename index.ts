const server = Bun.serve({
    port: 3000,
    async fetch(request) {
        let body = await request.json();
        console.log(body["image_url"]);
        const result = await fetch(body["image_url"]);
        const path = "./file.jpeg";
        await Bun.write(path, result);

        const proc = Bun.spawn(['ffmpeg', '-i', './file.jpeg', '-c:v', 'libwebp', '-y', 'out.webp']);
        let exitCode = await proc.exited
        if (exitCode == 0) {

            return new Response(Bun.file("out.webp"));
        } else {
            return new Response("No Data");
        }
    },
});

console.log(`Listening on localhost:${server.port}`);
