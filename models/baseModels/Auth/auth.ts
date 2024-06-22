import { Fyo } from "fyo";
import { DocValueMap } from "fyo/core/types";
import { Doc } from "fyo/model/doc";

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
  schemaName: string,
  docObject: DocValueMap,
  fyo: Fyo
) {
  
  return fyo.db.login(schemaName,docObject);
}
  