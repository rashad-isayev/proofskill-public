// Small arithmetic parser: no script execution, identifiers or external calls.
export function calculate(expression: string): number {
  if (!expression.trim() || expression.length > 300)
    throw new Error("Enter a calculation of up to 300 characters.");
  if (/[\d.]\s+[\d.]/.test(expression))
    throw new Error("Separate numbers with an operator.");
  const source = expression.replace(/\s/g, "");
  const tokens = source.match(/(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/%]/g) ?? [];
  if (tokens.join("") !== source)
    throw new Error("Use numbers, parentheses, +, −, *, / and % only.");
  let index = 0;
  function primary(): number {
    const token = tokens[index++];
    let value: number;
    if (token === "+" || token === "-") {
      value = primary() * (token === "-" ? -1 : 1);
    } else if (token === "(") {
      value = sum();
      if (tokens[index++] !== ")") throw new Error("Close each parenthesis.");
    } else if (token && /^(?:\d|\.)/.test(token)) value = Number(token);
    else throw new Error("Enter a complete calculation.");
    if (tokens[index] === "%") {
      index++;
      value /= 100;
    }
    return value;
  }
  function product(): number {
    let value = primary();
    while (tokens[index] === "*" || tokens[index] === "/") {
      const operator = tokens[index++];
      const right = primary();
      if (operator === "/" && right === 0)
        throw new Error("Cannot divide by zero.");
      value = operator === "*" ? value * right : value / right;
    }
    return value;
  }
  function sum(): number {
    let value = product();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const operator = tokens[index++];
      const right = product();
      value = operator === "+" ? value + right : value - right;
    }
    return value;
  }
  const result = sum();
  if (index !== tokens.length)
    throw new Error("Check the calculation’s operators and parentheses.");
  if (!Number.isFinite(result))
    throw new Error("The result is outside the supported range.");
  return Number(result.toPrecision(12));
}

export type DataRow = { source: string; field: string; value: string | number };
export function dataCsv(rows: DataRow[]): string {
  const cell = (value: string | number) => {
    const text = String(value);
    // Prevent a supplied text value being treated as a spreadsheet formula.
    const safe =
      typeof value === "string" && /^[\s]*[=+\-@\t\r]/.test(text)
        ? "'" + text
        : text;
    return '"' + safe.replaceAll('"', '""') + '"';
  };
  return [
    "Source,Field,Value",
    ...rows.map((row) =>
      [row.source, row.field, row.value].map(cell).join(","),
    ),
  ].join("\r\n");
}
