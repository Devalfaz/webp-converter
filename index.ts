import { unlink } from "node:fs/promises";
import { StorageReference, deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";

// const SITEID = "64f8c44ec0ed3efe8c8a1757";
// const token = "b4826e7558488175daf37ea2f398a00bc797013f583272756aae84333e8e45b9";

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyD4PfA-ArwGjtvegkrcMGzMwts9HhuSIv0",
    authDomain: "zartek-demo.firebaseapp.com",
    projectId: "zartek-demo",
    storageBucket: "zartek-demo.appspot.com",
    messagingSenderId: "389202053049",
    appId: "1:389202053049:web:096846e7d9063180e9d868"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const storage = getStorage(app);

const server = Bun.serve({
    port: 3000,
    async fetch(request) {
        const url = new URL(request.url);
        console.log(url.pathname);

        // if (url.pathname === "/") return optimizeImage(request);
        if (url.pathname === "/getCollectionDetails") return getCollectionDetails(request);
        if (url.pathname === "/optimizeItems") return optimizeItems(request);
        if (url.pathname === "/getCollections") return getCollections(request);
        return new Response("404!");

    },
});
// Helper function to calculate image size
async function calculateImageSize(url: string) {
    const imageFetch = await fetch(url);
    const blob = await imageFetch.blob();
    return blob.size;
}

async function optimizeItems(request: Request) {
    try {
        const url = new URL(request.url);
        const collection_id = url.searchParams.get('collection_id')
        const requestBody: string[] = await request.json();
        const collectionDetails = await fetch(`https://api.webflow.com/beta/collections/${collection_id}/items`, {
            headers: {
                accept: 'application/json', authorization: request.headers.get('Authorization')!,
            }
        });
        const items = await collectionDetails.json().then(e => e);
        const optimizedImages: { originalSize: number, optimizedSize: number, image: string }[] = [];
        for (const item of items.items) {

            const patchData: any = {
                id: item.id,
                fieldData: {}
            }

            // Loop through the fields to update
            for (const key of requestBody) {
                if (item.fieldData[key]) {
                    const originalSize = await calculateImageSize(item.fieldData[key].url);
                    const optimizedImageRef = await optimizeImage(item.fieldData[key].url);
                    const downloadURL = await getDownloadURL(optimizedImageRef);
                    const optimizedImageSize = await calculateImageSize(downloadURL);
                    patchData.fieldData[key] = { url: downloadURL };
                    console.log(patchData)
                    const updateResponse = await fetch(`https://api.webflow.com/beta/collections/${collection_id}/items/${item.id}`, {
                        headers: {
                            accept: 'application/json', authorization: request.headers.get('Authorization')!,
                        },
                        method: 'PATCH',
                        body: JSON.stringify(patchData),
                    });
                    console.log(await updateResponse.json())
                    optimizedImages.push({
                        image: item.fieldData[key].url,
                        optimizedSize: optimizedImageSize,
                        originalSize: originalSize,
                    })
                    deleteObject(optimizedImageRef);
                }
            }
        }
        return Response.json(optimizedImages);
    } catch (error) {
        console.error("Error:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}

async function getCollections(request: Request) {
    try {
        const url = new URL(request.url);
        const site_id = url.searchParams.get('site_id')
        const collectionsResponse = await fetch(`https://api.webflow.com/beta/sites/${site_id}/collections`, {
            headers: {
                accept: 'application/json', authorization: request.headers.get('Authorization')!,
            }
        });
        return collectionsResponse;
    } catch (error) {
        console.error("Error:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}

async function getCollectionDetails(request: Request) {
    const url = new URL(request.url);
    const collection_id = url.searchParams.get('collection_id')
    try {
        const collectionDetails = await fetch(`https://api.webflow.com/beta/collections/${collection_id}`, {
            headers: {
                accept: 'application/json', authorization: request.headers.get('Authorization')!,
            }
        });
        let data = await collectionDetails.json();
        let filteredFields = data.fields.filter((e: any) => e.type == "Image")
        return Response.json(filteredFields);
    } catch (error) {
        console.error("Error:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
}

async function optimizeImage(url: string): Promise<StorageReference> {
    try {
        const imageUrl = url;
        const imageName = imageUrl.split('/').pop()
        // Fetch the image
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to fetch image from ${imageUrl}`);
        }

        // Save the image to a file
        const imagePath = `./${imageName}`;
        await Bun.write(imagePath, imageResponse);
        // Output Path
        const output = `${imageName}.webp`
        // Run ffmpeg

        const proc = Bun.spawn(['ffmpeg', '-i', imagePath, '-c:v', 'libwebp', '-y', output]);
        const exitCode = await proc.exited;

        if (exitCode === 0) {
            const outputFile = Bun.file(output);

            const outputArrayBuffer = await outputFile.arrayBuffer();
            // Upload to firebase
            const outRef = ref(storage, output);
            const snapShot = await uploadBytes(outRef, outputArrayBuffer);
            // Delete the files after sending the response
            await unlink(imagePath);
            await unlink(output);
            return outRef;
        } else {
            await unlink(imagePath);
            await unlink(output);
            throw new Error(`Conversion failed`);
        }

    } catch (error) {
        console.error("Error:", error);
        throw new Error(`Conversion failed`);
    }

}
console.log(`Listening on localhost:${server.port}`);
