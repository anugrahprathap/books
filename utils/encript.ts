import { c } from 'tar';
import crypto from 'crypto';
import fs from 'fs/promises'; // Use promises version of fs
import { createReadStream, createWriteStream, unlinkSync, existsSync } from 'fs';

export async function createAndEncryptTar(filePath: string, password: string, isNew: boolean) {
  const tarFilePath = `${filePath}.tar.gz`;
  const encryptedFilePath = `${tarFilePath}.enc`;

  // Remove the encrypted file if it already exists
  if (existsSync(encryptedFilePath)) {
    await fs.unlink(encryptedFilePath);
  }

  // Create tar.gz file
  await c({ gzip: true, file: tarFilePath }, [filePath]);

  // Encrypt the tar.gz file using Node.js crypto module
  const iv = crypto.createHash("sha1").update(password, "utf8").digest().subarray(0, 16); // 16 bytes
  const cipher = crypto.createCipheriv("aes-256-cbc", crypto.createHash("sha256").update(password, "utf8").digest(), iv);

  const input = createReadStream(tarFilePath);
  const output = createWriteStream(encryptedFilePath);

  input.pipe(cipher).pipe(output);

  return new Promise((resolve, reject) => {
    output.on('finish', async () => {
      try {
        await fs.unlink(tarFilePath);
        
        if (!isNew) {
          
             unlinkSync(filePath);
           
        }
        resolve(encryptedFilePath);
      } catch (err) {
        reject(err);
      }
    });

    output.on('error', reject);
    input.on('error', reject);
  });
}

