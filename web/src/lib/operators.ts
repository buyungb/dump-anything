import type { FieldInfo } from "./fieldPaths";

export const OPERATORS: FieldInfo[] = [
  { path: "$eq", type: "equals" },
  { path: "$ne", type: "not equal" },
  { path: "$gt", type: "greater than" },
  { path: "$gte", type: "greater or equal" },
  { path: "$lt", type: "less than" },
  { path: "$lte", type: "less or equal" },
  { path: "$in", type: "in array" },
  { path: "$nin", type: "not in array" },
  { path: "$exists", type: "boolean" },
  { path: "$type", type: "BSON type" },
  { path: "$regex", type: "regex" },
  { path: "$options", type: "regex flags" },
  { path: "$size", type: "array size" },
  { path: "$all", type: "match all" },
  { path: "$elemMatch", type: "match element" },
  { path: "$and", type: "AND array" },
  { path: "$or", type: "OR array" },
  { path: "$nor", type: "NOR array" },
  { path: "$not", type: "NOT query" },
  { path: "$expr", type: "expression" },
  { path: "$mod", type: "modulo" },
];

export type QueryContext = "field" | "operator" | "value";

/**
 * Decide what the user is most likely typing at `cursor` inside a Mongo
 * filter JSON string:
 *   - "field"    -> a top-level filter key (e.g. user, profile.country)
 *   - "operator" -> an operator key inside a value object ({"amount":{"$gte":...}})
 *   - "value"    -> a string value (suggestions are not useful here)
 */
export function getQueryContext(value: string, cursor: number): QueryContext {
  let inString = false;
  const braceStack: { prevChar: string }[] = [];
  let stringOpenedAfter = "";
  let prevNonWs = "";

  for (let k = 0; k < cursor; k++) {
    const c = value[k];
    if (c === '"' && value[k - 1] !== "\\") {
      if (!inString) stringOpenedAfter = prevNonWs;
      inString = !inString;
      if (!inString) prevNonWs = '"';
      continue;
    }
    if (inString) continue;
    if (c === "{") braceStack.push({ prevChar: prevNonWs });
    else if (c === "}") braceStack.pop();
    if (!/\s/.test(c)) prevNonWs = c;
  }

  const top = braceStack[braceStack.length - 1];
  const inValueObject = !!top && top.prevChar === ":";

  if (inString) {
    if (
      stringOpenedAfter === "{" ||
      stringOpenedAfter === "," ||
      stringOpenedAfter === ""
    ) {
      return inValueObject ? "operator" : "field";
    }
    return "value";
  }
  return inValueObject ? "operator" : "field";
}
