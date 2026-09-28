import type { SupportedAgent } from "./agent";

export interface TextPosition {
  readonly line: number;
  readonly character: number;
}

export interface TextSelection {
  readonly start: TextPosition;
  readonly end: TextPosition;
}

export interface ReferenceInput {
  readonly filePath: string;
  readonly workspaceRoots: readonly string[];
  readonly selection?: TextSelection;
}

export function buildReference(input: ReferenceInput, agent: SupportedAgent): string {
  const filePath = normalize(input.filePath);
  const root = input.workspaceRoots.length !== 1
    ? undefined
    : normalize(input.workspaceRoots[0]).replace(/\/$/u, "");
  const referencePath = root !== undefined && isWithin(filePath, root)
    ? filePath.slice(root.length + 1)
    : filePath;

  const prefix = agent === "claude-code" ? "@" : "";
  return ` ${prefix}${quoteWhenNeeded(referencePath)}${lineSuffix(input.selection)} `;
}

function quoteWhenNeeded(value: string): string {
  return /\s/u.test(value) && !value.includes('"') ? `"${value}"` : value;
}

function lineSuffix(selection: TextSelection | undefined): string {
  if (selection === undefined || positionsEqual(selection.start, selection.end)) {
    return "";
  }

  const first = selection.start.line + 1;
  const last = (selection.end.character === 0 ? selection.end.line - 1 : selection.end.line) + 1;
  return first === last ? `#L${first}` : `#L${first}-L${last}`;
}

function positionsEqual(first: TextPosition, second: TextPosition): boolean {
  return first.line === second.line && first.character === second.character;
}

function normalize(value: string): string {
  return value.replaceAll("\\", "/");
}

function isWithin(filePath: string, root: string): boolean {
  const windowsPath = /^[A-Za-z]:\//u.test(filePath) && /^[A-Za-z]:\//u.test(root);
  const comparableFile = windowsPath ? filePath.toLowerCase() : filePath;
  const comparableRoot = windowsPath ? root.toLowerCase() : root;
  return comparableFile.startsWith(`${comparableRoot}/`);
}
