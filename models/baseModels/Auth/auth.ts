import { Fyo } from "fyo";
import { DocValueMap } from "fyo/core/types";
import { Doc } from "fyo/model/doc";
import { showDialog } from "src/utils/interactive";
export class AuthSchemaSetup extends Doc{
      
}

export async function checkAndCreateDoc(
    schemaName: string,
    docObject: DocValueMap,
    fyo: Fyo
  ):Promise<Doc | undefined>  {
    
   
    const doc = fyo.doc.getNewDoc(schemaName, docObject);
    
    return doc.sync();
    // const doc = await fyo.db.insert(schemaName,docObject);

    
  }

  


export async function userLogin(
  docObject: DocValueMap,
  fyo: Fyo
): Promise<[boolean, string | null]> {
  const filePath = fyo.config.config.get("lastSelectedFilePath") as string;
  const password = docObject.password as string;
  
  try {
    // Fetch the outputFilePath asynchronously
    // Attempt decryption
    const result = await ipc.decript(filePath, password, fyo.store.isDevelopment);

    if (result.success) {
      // Successful decryption
      const decryptedFilePath = result.extractedFolderPath;
      fyo.config.set("lastSelectedFilePath", decryptedFilePath);
      return [true, decryptedFilePath];
    } else {
      // Failed decryption
      await showDialog({
        title: 'Cannot open file',
        type: 'error',
        detail: 'Failed to decrypt the selected file: ' + filePath,
      });
      fyo.config.set("lastSelectedFilePath", null);
      return [false, null];
    }
  } catch (error) {
    // Error handling
    await showDialog({
      title: 'Cannot open file',
      type: 'error',
      detail: 'Failed to decrypt the selected file: ' + filePath,
    });
    return [false, null];
  }
}

  