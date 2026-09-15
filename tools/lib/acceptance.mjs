// Small, strict Markdown contract; unsupported criterion-like syntax fails closed.
const ID = /^[A-Z]+(?:-[A-Z]+)*-[A-Z]*\d+$/;
const sectionTitle = /^(?:acceptance criteria|受入条件|受け入れ条件)$/i;
function failure(kind, detail, line) {
  throw new Error(kind + (line ? " at line " + line : "") + ": " + detail);
}
export function assertAcceptanceId(id, line) {
  if (typeof id !== "string" || id.length > 96 || !ID.test(id)) failure("Invalid acceptance ID", String(id), line);
  return id;
}
function candidate(line) {
  // The generated question ledger has its own unambiguous, non-criterion shape.
  if (/^\s*[-*+]\s+\[[ xX]\]\s+\*\*Q-[A-Z0-9-]+\s+[^*]+\*\*\s+[—–-]\s+/.test(line)) return false;
  // Normalize only detection, never the actual definition/ID. Unsupported
  // bullets, decorations and invisible prefixes must not hide a candidate.
  const start = line.replace(/\p{Cf}/gu, "").trim().replace(/^(?:>\s*|\|\s*|[-*+]\s+|\d+[.)]\s+)*/, "")
    .replace(/^\[[^\]]*\]\s*/, "").replace(/^[^\p{L}\p{N}]+/u, "");
  const token = start.match(/^([^ \t:：]+)[ \t]*[:：]/)?.[1];
  return (token && /\p{Number}/u.test(token)) ||
    /^(?:[A-Z]+[-_\u2010-\u2015]\S*|[a-z]+[-_][A-Za-z]*\d\S*|[aA][cC](?:[^a-zA-Z]|$))/.test(start);
}
function documentLines(content) {
  if (typeof content !== "string") failure("Invalid acceptance document", "expected text");
  const lines = content.replace(/^\uFEFF/, "").replace(/\r\n?/g, "\n").split("\n");
  if (lines[0] === "---") {
    const end = lines.findIndex((line, i) => i > 0 && /^(?:---|\.\.\.)\s*$/.test(line));
    if (end < 0) failure("Unclosed acceptance frontmatter", "close the metadata block", 1);
    lines.fill("", 0, end + 1);
  }
  let fence = null, comment = false;
  const result = lines.map((source, index) => {
    if (fence) {
      if (new RegExp("^ {0,3}" + fence.char + "{" + fence.size + ",}[ \\t]*$").test(source)) fence = null;
      return { text: "", line: index + 1 };
    }
    let text = "", cursor = 0;
    while (cursor < source.length) {
      const marker = source.indexOf(comment ? "-->" : "<!--", cursor);
      if (marker < 0) { if (!comment) text += source.slice(cursor); break; }
      if (!comment) text += source.slice(cursor, marker);
      text += " ";
      cursor = marker + (comment ? 3 : 4);
      comment = !comment;
    }
    const opening = text.match(/^ {0,3}(\x60{3,}|~{3,})(.*)$/);
    if (opening) {
      if (opening[1][0] === String.fromCharCode(96) && /\x60/.test(opening[2])) failure("Invalid acceptance fence", "backtick info strings cannot contain backticks", index + 1);
      fence = { char: opening[1][0], size: opening[1].length, line: index + 1 };
      return { text: "", line: index + 1 };
    }
    if (/^\s*<(?:[A-Za-z/!?])/.test(text)) failure("Invalid acceptance document", "raw HTML blocks are unsupported; fence examples", index + 1);
    return { text, line: index + 1 };
  });
  if (fence) failure("Unclosed acceptance fence", "close the example block", fence.line);
  if (comment) failure("Unclosed acceptance comment", "close the HTML comment");
  return result;
}
export function acceptanceIds(content) {
  const lines = documentLines(content), headings = new Map();
  for (let i = 0; i < lines.length; i++) {
    const atx = lines[i].text.match(/^ {0,3}(#{1,6})[ \t]+(.+?)(?:[ \t]+#+)?[ \t]*$/);
    if (atx) headings.set(i, { depth: atx[1].length, title: atx[2].trim() });
    else if (i + 1 < lines.length && lines[i].text.trim() && !candidate(lines[i].text) && !/^\s*[-*+>]/.test(lines[i].text) && /^ {0,3}(?:=+|-+)[ \t]*$/.test(lines[i + 1].text)) {
      headings.set(i, { depth: lines[i + 1].text.trim()[0] === "=" ? 1 : 2, title: lines[i].text.trim() });
      headings.set(i + 1, { underline: true });
    }
  }
  const explicit = [...headings.values()].some(h => sectionTitle.test(h.title ?? ""));
  let section = null, questionLedger = null, continuation = false, indentation = null;
  const ids = [], locations = new Map();
  for (let i = 0; i < lines.length; i++) {
    const { text, line } = lines[i], heading = headings.get(i);
    if (heading) {
      if (heading.underline) continue;
      if (questionLedger !== null && heading.depth <= questionLedger) questionLedger = null;
      if (["Refined answers — authoritative question ledger", "確認済みの回答 — 正本の質問台帳"].includes(heading.title)) questionLedger = heading.depth;
      const generatedQuestion = questionLedger !== null && heading.depth === questionLedger + 1 &&
        /^Q-[A-Z0-9-]+ [a-z]+(?:-[a-z]+)*$/.test(heading.title);
      if (!generatedQuestion && candidate(heading.title)) {
        failure("Invalid acceptance definition", "headings cannot define criteria; use a bullet", line);
      }
      if (sectionTitle.test(heading.title)) section = heading.depth;
      else if (section !== null && heading.depth <= section) section = null;
      continuation = false;
      indentation = null;
      continue;
    }
    if (!text.trim()) continue;
    const looksLikeId = candidate(text);
    if (explicit && section === null) {
      if (looksLikeId) failure("Invalid acceptance location", "move criterion definitions into the acceptance section or fence examples", line);
      continue;
    }
    const bullet = text.match(/^ {0,3}[-*+][ \t]+(?:\[[ xX]\][ \t]+)?(.*)$/);
    if (!bullet) {
      if (looksLikeId || (explicit && !(continuation && /^[ \t]+\S/.test(text)))) {
        failure("Invalid acceptance definition", "use '- AC-01: observable outcome'; fence examples", line);
      }
      continue;
    }
    if (!explicit && !looksLikeId) { continuation = false; continue; }
    const definition = bullet[1].match(/^([^ \t:]+):[ \t]*(.*)$/);
    if (!definition) failure("Invalid acceptance definition", "expected ID: observable outcome", line);
    const id = assertAcceptanceId(definition[1], line);
    const indent = text.length - text.trimStart().length;
    if (indentation !== null && indent !== indentation) failure("Invalid acceptance indentation", "nested or mixed-indent criterion definitions are unsupported", line);
    indentation = indent;
    if (!definition[2].trim()) failure("Empty acceptance criterion", id, line);
    if (locations.has(id)) failure("Duplicate acceptance criterion " + id, "first defined at line " + locations.get(id), line);
    ids.push(id); locations.set(id, line); continuation = true;
  }
  if (!ids.length) failure("No acceptance criteria", "define at least one '- AC-01: observable outcome'");
  return ids;
}
export function assertAcceptanceCoverage(ids, entries) {
  if (!Array.isArray(entries) || !entries.length) failure("No acceptance criteria in review", "provide criterion results");
  const seen = new Set();
  for (const entry of entries) {
    const id = assertAcceptanceId(entry?.id);
    if (seen.has(id)) failure("Duplicate acceptance criterion in review", id);
    seen.add(id);
  }
  const unexpected = [...seen].filter(id => !ids.includes(id));
  if (unexpected.length) failure("Unexpected acceptance criteria", unexpected.join(", "));
  const missing = ids.filter(id => !seen.has(id));
  if (missing.length) failure("Missing acceptance criteria", missing.join(", ") + "; review must cover every requirement acceptance criterion; verification must cover all acceptance criteria");
}
