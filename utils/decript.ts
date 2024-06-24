import { unlinkSync, existsSync, mkdirSync } from 'fs';
import { extract } from 'tar';
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

export async function decryptAndExtractTar(encryptedFilePath: string, password: string) {
  console.log("Decrypting file:", encryptedFilePath);

  // Ensure the correct path and filenames are set
  const tarFilePath = encryptedFilePath.replace('.enc', '');
  const extractedFolderPath = tarFilePath.replace('.tar.gz', '');

  console.log("Decrypted tar file will be:", tarFilePath);
  console.log("Extracted folder path:", extractedFolderPath);

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
      console.log('<<< File ' + encryptedFilePath + ' decrypted as ' + tarFilePath);
      fs.unlinkSync(encryptedFilePath);
      if (!existsSync(extractedFolderPath)) {
        mkdirSync(extractedFolderPath, { recursive: true });
      }
    
      // Extract the tarball
      await extract({ file: tarFilePath, cwd: extractedFolderPath });
      resolve();
    });

    output.on('error', (err: Error) => {
      reject(err);
    });
  });

  // Check if decrypted tar file exists
  
  console.log('Extraction complete:', extractedFolderPath);

  // Optionally, delete the decrypted tar file
  unlinkSync(tarFilePath);

  return extractedFolderPath;
}
