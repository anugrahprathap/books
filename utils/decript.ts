import { unlinkSync, existsSync, mkdirSync } from 'fs';
import { extract } from 'tar';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

export async function decryptAndExtractTar(encryptedFilePath: string, password: string) {
  // Ensure the correct path and filenames are set
  const tarFilePath = encryptedFilePath.replace('.enc', '');
  const fileName = path.basename(tarFilePath).replace(".tar.gz",'');
  console.log("File >>>",fileName);
  const baseFolderPath = path.dirname(tarFilePath);
  const extractedFolderPath = path.join(baseFolderPath,"temp");
  const extractedFilePath = path.join(extractedFolderPath,"dbs//Frappe Books",fileName);
  // Check if encrypted file exists
  if (!fs.existsSync(encryptedFilePath)) {
    throw new Error(`Encrypted file does not exist: ${encryptedFilePath}`);
  }
  // Decrypt the encrypted file
  let iv = crypto.createHash("sha1").update(password, "utf8").digest().slice(0, 16); // 16 bytes
  let decipher = crypto.createDecipheriv("aes-256-cbc", crypto.createHash("sha256").update(password, "utf8").digest(), iv);

  let input = fs.createReadStream(encryptedFilePath);
  let output = fs.createWriteStream(tarFilePath);

  input.pipe(decipher).pipe(output);

  await new Promise<void>((resolve, reject) => {
    output.on('finish', async () => {
      try {
        // Ensure all I/O operations are completed
        output.close();

        // Check if decrypted tar file exists
        if (!fs.existsSync(tarFilePath)) {
          throw new Error(`Decrypted tar file does not exist: ${tarFilePath}`);
        }

        // Create extracted folder if it doesn't exist
        if (!existsSync(extractedFolderPath)) {
          mkdirSync(extractedFolderPath, { recursive: true });
        }
        if (existsSync(extractedFilePath)) {
          unlinkSync(extractedFilePath);
        }


        // Extract the tarball
        await extract({ file: tarFilePath, cwd: extractedFolderPath });
        console.log('Extraction complete:', extractedFilePath);

        // Optionally, delete the decrypted tar file
        unlinkSync(tarFilePath);

        resolve();
      } catch (err) {
        console.error("File handling error:", err);
        reject(err);
      }
    });

    output.on('error', (err: Error) => {
      reject(err);
    });
  });

  if (!fs.existsSync(extractedFilePath)) {
    throw new Error(`Database file does not exist: ${extractedFilePath}`);
  }

  

  

  return extractedFilePath;
}
