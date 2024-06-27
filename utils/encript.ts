
import { c } from 'tar';
const crypto = require('crypto');
const fs = require('fs');


export async function createAndEncryptTar(filePath: string, password: string,isNew: boolean) {
  console.log("Password : ",password)
  const tarFilePath = `${filePath}.tar.gz`;
  const encryptedFilePath = `${tarFilePath}.enc`;

  // Create tar.gz file
  await c({ gzip: true, file: tarFilePath }, [filePath]);

  // Encrypt the tar.gz file using Node.js crypto module
    let iv = crypto.createHash("sha1").update(password, "utf8").digest().subarray(0, 16); // 16 bytes

    let cipher = crypto.createCipheriv("aes-256-cbc", crypto.createHash("sha256").update(password, "utf8").digest(), iv);

    let input = fs.createReadStream(tarFilePath);
    let output = fs.createWriteStream(tarFilePath + '.enc');

    input.pipe(cipher).pipe(output);

    output.on('finish', function () {
        fs.unlinkSync(tarFilePath);
        if(!isNew){
          fs.unlinkSync(filePath);
        }
    });
    
  return encryptedFilePath;
}
