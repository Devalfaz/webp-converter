import express from "express";
import { StorageReference, deleteObject, getDownloadURL, getStorage, ref, uploadBytes } from "firebase/storage";
import { unlink } from "node:fs/promises";
import cors from "cors";
var timeout = require('connect-timeout');
const app = express();
const port = 8080;

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import axios from "axios";
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

// Helper function to calculate image size
async function calculateImageSize(url: string) {
    const imageFetch = await fetch(url);
    const blob = await imageFetch.blob();
    return blob.size;
}

// Initialize Firebase
const firebaseapp = initializeApp(firebaseConfig);

const storage = getStorage(firebaseapp);

app.use(cors());
app.use(express.json());
app.use(timeout('300s'));


app.get("/getCollections", async (req, res) => {
    try {
        const site_id = req.query.site_id;
        const collectionsResponse = await fetch(`https://api.webflow.com/beta/sites/${site_id}/collections`, {
            headers: {
                accept: 'application/json', Authorization: req.headers.authorization!,
            }
        });
        const collectionsData = await collectionsResponse.json()
        res.json(collectionsData);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");

    }
});

app.get("/getAccessToken", async (req, res) => {
    try {
        const client_id = req.query.client_id;
        const client_secret = req.query.client_secret;
        const code = req.query.code;

        const collectionsResponse = await axios.post(`https://api.webflow.com/oauth/access_token`, "", {
            headers: {
                accept: 'application/json'
            },
            params: {
                client_id,
                client_secret,
                code,
                grant_type: 'authorization_code',
            }
        });
        const collectionsData = await collectionsResponse.data
        res.json(collectionsData);
    } catch (error) {
        console.error("Error:", 'error');
        res.status(500).send("Internal Server Error");

    }
});

app.get("/getSites", async (req, res) => {
    try {
        const site_id = req.query.site_id;
        const collectionsResponse = await fetch(`https://api.webflow.com/beta/sites`, {
            headers: {
                accept: 'application/json', Authorization: req.headers.authorization!,
            }
        });
        const collectionsData = await collectionsResponse.json()
        res.json(collectionsData);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");

    }
});

app.get("/getCollectionDetails", async (req, res) => {
    try {
        const collection_id = req.query.collection_id;
        const collectionsResponse = await fetch(`https://api.webflow.com/beta/collections/${collection_id}`, {
            headers: {
                accept: 'application/json', Authorization: req.headers.authorization!,
            }
        });
        const collectionsData = await collectionsResponse.json()
        let filteredFields = collectionsData.fields.filter((e: any) => e.type == "Image")
        res.json(filteredFields);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");

    }
});

app.post("/optimizeItems", async (req, res) => {
    try {
        const collection_id = req.query.collection_id;
        const collectionsResponse = await fetch(`https://api.webflow.com/beta/collections/${collection_id}/items`, {
            headers: {
                accept: 'application/json', Authorization: req.headers.authorization!,
            }
        });
        const requestBody: string[] = await req.body;
        const items = await collectionsResponse.json().then(e => e);
        const optimizedImages: { originalSize: number, optimizedSize: number, image: string }[] = [];
        console.log(items.items.length)
        for (const item of items.items) {
            const patchData: any = {
                fieldData: {}
            }
            // Loop through the fields to update
            for (const key of requestBody) {
                if (item.fieldData[key]) {
                    const originalSize = await calculateImageSize(item.fieldData[key].url);
                    console.log(originalSize);
                    const optimizedImageRef = await optimizeImage(item.fieldData[key].url);
                    console.log(optimizedImageRef.fullPath);
                    const downloadURL = await getDownloadURL(optimizedImageRef);
                    console.log(downloadURL);
                    const optimizedImageSize = await calculateImageSize(downloadURL);
                    console.log(optimizedImageSize);
                    patchData.fieldData[key] = { url: downloadURL };
                    console.log(patchData)
                    const updateResponse = await axios.patch(`https://api.webflow.com/beta/collections/${collection_id}/items/${item.id}`, { ...patchData },
                        {
                            headers: {
                                Authorization: req.headers.authorization!,
                                Accept: 'application/json',
                            }
                        });
                    console.log(updateResponse.data)
                    optimizedImages.push({
                        image: item.fieldData[key].url,
                        optimizedSize: optimizedImageSize,
                        originalSize: originalSize,
                    })
                    // deleteObject(optimizedImageRef);
                    // https://api.webflow.com/beta/sites/{site_id}/publish
                }
            }

        }
        res.json(optimizedImages);
    } catch (error) {
        console.error("Error:", error);
        res.status(500).send("Internal Server Error");

    }
});


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


app.listen(port, () => {
    console.log(`Listening on port ${port}...`);
});