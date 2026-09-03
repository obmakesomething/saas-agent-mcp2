import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { TruthEngine } from "../src/engine.mjs";
import { createToolDefinitions } from "../src/webmcp.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const tools = createToolDefinitions(new TruthEngine());
const errors = [];
const names = new Set();

for (const tool of tools) {
  if (names.has(tool.name)) errors.push(`duplicate tool name: ${tool.name}`);
  names.add(tool.name);
  if (tool.name.length > 30) errors.push(`tool name exceeds 30 chars: ${tool.name}`);
  if (tool.description.length > 500) errors.push(`description exceeds 500 chars: ${tool.name}`);
  if (tool.inputSchema?.additionalProperties !== false) {
    errors.push(`schema must close additional properties: ${tool.name}`);
  }
  for (const [name, schema] of Object.entries(tool.inputSchema?.properties ?? {})) {
    if (name.length > 30) errors.push(`parameter name exceeds 30 chars: ${tool.name}.${name}`);
    if ((schema.description ?? "").length > 150) {
      errors.push(`parameter description exceeds 150 chars: ${tool.name}.${name}`);
    }
  }
}

const index = await fs.readFile(path.join(root, "index.html"), "utf8");
const webmcpSource = await fs.readFile(path.join(root, "src/webmcp.mjs"), "utf8");
const license = await fs.readFile(path.join(root, "LICENSE"), "utf8");
if (!webmcpSource.includes("modelContext.registerTool")) {
  errors.push("imperative WebMCP registration is missing");
}
if (!index.includes('src="/src/app.mjs"')) errors.push("app module is not loaded");
if (!license.includes("MIT License")) errors.push("MIT license is incomplete");
if (tools.length < 5) errors.push("implementation is too shallow: fewer than 5 tools");

if (errors.length) {
  console.error(errors.map((error) => `- ${error}`).join("\n"));
  process.exit(1);
}

console.log(`Validated ${tools.length} WebMCP tools and required repository assets.`);
