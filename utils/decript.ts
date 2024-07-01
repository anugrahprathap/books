import { unlinkSync, existsSync, mkdirSync } from 'fs';
import { extract } from 'tar';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export async function decryptAndExtractTar(encryptedFilePath: string, password: string,isDevelopment: boolean) {
  const tarFilePath = encryptedFilePath.replace('.enc', '');
  const fileName = path.basename(tarFilePath).replace(".tar.gz",'');
  const baseFolderPath = path.dirname(encryptedFilePath);
  const extractedFilePath =path.join(baseFolderPath,fileName);
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
       
        if (existsSync(extractedFilePath)) {
          resolve(); // Resolve the promise
          return extractedFilePath;
        }
        // Extract the tarball
        await extract({ file: tarFilePath });
        console.log('Extraction complete:', extractedFilePath);
        resolve();
      } catch (err) {
        console.error("File handling error:", err);
        reject(err);
      }
      finally{
        // Optionally, delete the decrypted tar file
        unlinkSync(tarFilePath);
      }
    });

    output.on('error', (err: Error) => {
      reject(err);
    });
  });

 
  return extractedFilePath;
}
