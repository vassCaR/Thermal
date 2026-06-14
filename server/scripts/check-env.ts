import { loadEnvFile } from "../src/env.js";
import { loadConfig } from "../src/config.js";
loadEnvFile();
const c = loadConfig();
const inspect = (k:string,v:string)=>console.log(`${k}: len=${v.length} startsWithHash=${v.trimStart().startsWith("#")} empty=${v.length===0}`);
inspect("UNLINK_API_KEY", c.unlinkApiKey);
inspect("UNLINK_ENV", c.unlinkEnv);
inspect("UNLINK_ENGINE_URL", c.unlinkEngineUrl);
