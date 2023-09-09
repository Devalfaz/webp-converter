const server = Bun.serve({
    port: 3000,
    async fetch(request) {
        let body = await request.json();
        console.log(body["image_url"]);
        const result = await fetch(body["image_url"]);
        const path = "./file.jpeg";
        await Bun.write(path, result);

        const proc = Bun.spawn(["echo", "hello"]);
        // return new Response(await new Response(proc.stdout).text());
        return new Response(Bun.file("./README.md"));
    },
});

console.log(`Listening on localhost:${server.port}`);
