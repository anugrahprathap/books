import { createCipheriv, randomBytes } from 'crypto';
import { createReadStream, createWriteStream, unlinkSync } from 'fs';
import { pipeline } from 'stream';
import { promisify } from 'util';
import { c } from 'tar';

const pipelineAsync = promisify(pipeline);

export async function createAndEncryptTar(filePath: string, password: string) {
  const tarFilePath = `${filePath}.tar.gz`;
  const encryptedFilePath = `${tarFilePath}.enc`;

  // Create tar.gz file
  await c({ gzip: true, file: tarFilePath }, [filePath]);

  // Encrypt the tar.gz file using Node.js crypto module
  const algorithm = 'aes-256-cbc';
  const key = Buffer.from(password.padEnd(32, ' '), 'utf8');
  const iv = randomBytes(16);
  const cipher = createCipheriv(algorithm, key, iv);

  const input = createReadStream(tarFilePath);
  const output = createWriteStream(encryptedFilePath);

  await pipelineAsync(input, cipher, output);

  // Optionally, delete the original tar.gz file
  unlinkSync(tarFilePath);
  console.log(encryptedFilePath);
  return encryptedFilePath;
}
