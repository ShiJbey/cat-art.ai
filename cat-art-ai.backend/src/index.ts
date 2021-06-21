import * as fs from 'fs';
import * as path from 'path';
import { Command, program } from 'commander';
import * as ProgressBar from 'progress';
import * as admin from 'firebase-admin';
import * as serviceAccount from './admin.json';
import * as sharp from 'sharp';

interface ImageEntry {
  path?: string;
  url?: string;
  wins?: number;
  losses?: number;
  score?: number;
}

function createImageEntry(opts?: { path?: string; url?: string }): ImageEntry {
  return {
    path: opts?.path || '',
    url: opts?.url || '',
    wins: 0,
    losses: 0,
    score: 1000,
  };
}

function uploadImage(
  file: Buffer,
  storage: admin.storage.Storage,
  path: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    try {
      const blob = storage.bucket('gs://cat-art-duel.appspot.com').file(path);
      const stream = blob.createWriteStream({
        resumable: false,
        public: true,
        contentType: 'auto',
      });

      stream.on('finish', () => {
        blob.makePublic().then(() => {
          resolve(blob.publicUrl());
        });
      });

      stream.on('error', () => {
        reject(`Unable to upload image, something went wrong`);
      });

      stream.end(file);
    } catch (err) {
      console.error(err);
      reject(err);
    }
  });
}

async function DownloadImage(): Promise<Buffer> {
  return Buffer.from('');
}

async function DownloadDatabase(): Promise<ImageEntry[]> {
  return [];
}

(async function main(): Promise<void> {
  program
    .description('Manage back-end services for cat-art-duel.web.app');

  program
    .command('upload-images <source> [destination]')
    .option('-c, --create', 'Create output directory if it doesnt e destinations')
    .description('Upload images from a source directory and copy the uploaded files with their assigned IDs')
    .action(async (source, destination='./data/uploaded', options: any) => {
      const {create} = options;
      console.log(source, destination, create);

      try {

        // Create destination directory if it doesnt exist
        if (!fs.existsSync(destination) && create) {
          fs.mkdirSync(destination, { recursive: true });
        }

        const imagesDir = path.join(process.cwd(), source);

        const imageFiles = fs.readdirSync(imagesDir);

        admin.initializeApp({
          credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
        });

        const firestore = admin.firestore();

        const storage = admin.storage();

        console.log(`Uploading ${imageFiles.length} images...`);

        const bar = new ProgressBar(' uploading [:bar] :percent', {
          complete: '#',
          incomplete: '_',
          total: imageFiles.length,
        });

        for (const name of imageFiles) {
          // Create a database entry for it
          // Upload to storage and change name to be the name
          // of the entry within the database

          const entry = createImageEntry();

          const doc = await firestore.collection('samples').add(entry);

          const storagePath = `samples/${doc.id}.png`;

          const file = sharp(path.join(imagesDir, name)).png();

          const storageURL = await uploadImage(await file.toBuffer(), storage, storagePath);

          await doc.update({
            path: storagePath,
            url: storageURL,
          } as ImageEntry);

          file.toFile(path.join(destination, `${doc.id}.png`));

          bar.tick();
        }
      } catch (err) {
        console.error(err);
      }
    });

  program
    .command('download-images <destination>')
    .description('Download sample images from the site to a given directory')
    .action(async (destination) => {

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      });

      const storage = admin.storage();

      const bucket = storage.bucket('gs://cat-art-duel.appspot.com');

      let [files] = await bucket.getFiles({prefix: 'samples'});

      console.log(`Uploading ${files.length} images...`);

      const bar = new ProgressBar(' uploading [:bar] :percent', {
        complete: '#',
        incomplete: '_',
        total: files.length,
      });

      for (const file of files) {
        const basename = path.basename(file.name);
        await file.download({
          destination: path.join(destination, basename)
        })
        bar.tick();
      }
    });

  program
    .command('download-database')
    .option('-o, --out <destination>', 'output file name')
    .description('Download all the data from the database')
    .action(async ({ out:destination='database.json' }) => {

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount as admin.ServiceAccount),
      });

      const firestore = admin.firestore();

      const collection = await firestore.collection('samples').orderBy('score').get();

      const bar = new ProgressBar(' uploading [:bar] :percent', {
        complete: '#',
        incomplete: '_',
        total: collection.docs.length,
      });

      const output = [];

      for (const doc of collection.docs) {
        const data = doc.data();
        output.push(data);
        bar.tick();
      }

      fs.writeFileSync(destination, JSON.stringify(output));
    });


  program.parse(process.argv);
})();
