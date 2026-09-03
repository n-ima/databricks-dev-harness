import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { exists, readJson, repoRelative } from "./shared.mjs";

// Deliberately small validator for the vocabulary used by this repository's schemas.
// Not a general-purpose JSON Schema implementation; unsupported assertion keywords fail explicitly.
const keywords = new Set(["$schema", "$id", "title", "description", "type", "required", "properties", "items", "additionalProperties", "enum", "const", "minimum", "maximum", "exclusiveMinimum", "minItems", "maxItems", "minLength", "pattern", "format"]);
export function validateSchema(schema, value, location = "$") {
  const errors = [];
  for (const key of Object.keys(schema)) if (!keywords.has(key)) errors.push(`${location}: unsupported schema keyword ${key}`);
  const type = (candidate) => candidate === "null" ? value === null : candidate === "array" ? Array.isArray(value) : candidate === "object" ? value !== null && typeof value === "object" && !Array.isArray(value) : candidate === "integer" ? Number.isInteger(value) : typeof value === candidate;
  if (schema.type && !(Array.isArray(schema.type) ? schema.type : [schema.type]).some(type)) return [...errors, `${location}: invalid type`];
  if (schema.enum && !schema.enum.some((item) => JSON.stringify(item) === JSON.stringify(value))) errors.push(`${location}: unexpected enum value`);
  if (Object.hasOwn(schema, "const") && JSON.stringify(value) !== JSON.stringify(schema.const)) errors.push(`${location}: unexpected constant`);
  if (typeof value === "number") {
    if (!Number.isFinite(value) || (schema.minimum != null && value < schema.minimum) || (schema.maximum != null && value > schema.maximum) || (schema.exclusiveMinimum != null && value <= schema.exclusiveMinimum)) errors.push(`${location}: outside numeric bounds`);
  }
  if (typeof value === "string") {
    if (schema.minLength && [...value].length < schema.minLength) errors.push(`${location}: string too short`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errors.push(`${location}: pattern mismatch`);
    if (schema.format === "date-time" && (!/^\d{4}-\d{2}-\d{2}T/.test(value) || !Number.isFinite(Date.parse(value)))) errors.push(`${location}: invalid date-time`);
    if (schema.format && schema.format !== "date-time") errors.push(`${location}: unsupported format ${schema.format}`);
  }
  if (Array.isArray(value)) {
    if ((schema.minItems != null && value.length < schema.minItems) || (schema.maxItems != null && value.length > schema.maxItems)) errors.push(`${location}: invalid array length`);
    if (schema.items) value.forEach((item, index) => errors.push(...validateSchema(schema.items, item, `${location}[${index}]`)));
  } else if (value && typeof value === "object") {
    for (const key of schema.required ?? []) if (!Object.hasOwn(value, key)) errors.push(`${location}: missing ${key}`);
    for (const [key, item] of Object.entries(value)) {
      if (schema.properties?.[key]) errors.push(...validateSchema(schema.properties[key], item, `${location}.${key}`));
      else if (schema.additionalProperties === false) errors.push(`${location}: unknown property ${key}`);
      else if (schema.additionalProperties && typeof schema.additionalProperties === "object") errors.push(...validateSchema(schema.additionalProperties, item, `${location}.${key}`));
    }
  }
  return errors;
}

async function jsonFiles(directory) {
  if (!(await exists(directory))) return [];
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await jsonFiles(path));
    else if (entry.name.endsWith(".json")) files.push(path);
  }
  return files;
}

export async function validateDurableArtifacts(root) {
  const errors = [];
  const collections = [["work/loops", "loop"], ["work/scaffolds", "scaffold-plan"], ["work/approvals", "approval"], ["docs/product/intake", "intake"]];
  for (const [directory, schemaName] of collections) {
    const schema = await readJson(join(root, `harness/schemas/${schemaName}.schema.json`));
    for (const path of await jsonFiles(join(root, directory))) {
      if (schemaName === "intake" && !path.endsWith("intake.json")) continue;
      try { errors.push(...validateSchema(schema, JSON.parse(await readFile(path, "utf8")), repoRelative(root, path))); }
      catch { errors.push(`Invalid durable JSON: ${repoRelative(root, path)}`); }
    }
  }
  return errors;
}
