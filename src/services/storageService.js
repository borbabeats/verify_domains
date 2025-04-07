const fs = require("fs").promises;
const path = require("path");

class StorageService {
  static async loadDomainsFromFile(filePath = "../../domains.json") {
    try {
      const resolvedPath = path.join(__dirname, filePath);
      console.log(`Trying to load domains from: ${resolvedPath}`);
  
      const data = await fs.readFile(resolvedPath, "utf8");
      const domains = JSON.parse(data);
  
      if (!domains || !Array.isArray(domains)) {
        throw new Error("Invalid domains file format");
      }
  
      console.log(`Successfully loaded ${domains.length} domains`);
      return domains;
    } catch (error) {
      console.error("Failed to load domains:", error.message);
      return [];
    }
  }
}

module.exports = StorageService;
