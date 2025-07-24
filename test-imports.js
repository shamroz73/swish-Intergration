// Simple test to verify ES6 imports work
import config from "./config/index.js";
import { formatPhoneNumber } from "./utils/phoneUtils.js";

console.log("✅ Config loaded:", typeof config);
console.log("✅ Phone utils loaded:", typeof formatPhoneNumber);
console.log("✅ Server port:", config.port);
console.log("✅ ES6 imports working correctly!");

process.exit(0);
