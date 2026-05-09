export interface StrippedLine {
  lineNumber: number;
  code: string;
}

export function stripComments(lines: string[]): StrippedLine[] {
  const result: StrippedLine[] = [];
  let inBlock = false;

  for (let i = 0; i < lines.length; i++) {
    let code = lines[i];

    if (inBlock) {
      const end = code.indexOf('*/');
      if (end >= 0) {
        code = code.substring(end + 2);
        inBlock = false;
      } else {
        result.push({ lineNumber: i + 1, code: '' });
        continue;
      }
    }

    while (!inBlock) {
      const start = code.indexOf('/*');
      if (start < 0) break;
      const end = code.indexOf('*/', start + 2);
      if (end >= 0) {
        code = code.substring(0, start) + code.substring(end + 2);
      } else {
        code = code.substring(0, start);
        inBlock = true;
      }
    }

    let stripped = code;
    let inStr = false;
    let strChar: string | null = null;
    for (let j = 0; j < code.length; j++) {
      const ch = code[j];
      if (!inStr && (ch === '"' || ch === "'")) {
        inStr = true;
        strChar = ch;
      } else if (inStr && ch === strChar && (j === 0 || code[j - 1] !== '\\')) {
        inStr = false;
        strChar = null;
      } else if (!inStr && code.substring(j, j + 2) === '//') {
        stripped = code.substring(0, j);
        break;
      }
    }

    result.push({ lineNumber: i + 1, code: stripped });
  }

  return result;
}
