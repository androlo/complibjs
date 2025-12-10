import {CFBit} from "./types";

export const print2DAdj = (adj: CFBit[][], labels?: string[]): string => {
    const n = adj.length;
    if (n === 0) return "<empty>";

    // Default labels: "0", "1", ..., "n-1"
    const colLabels = labels ?? Array.from({ length: n }, (_, i) => String(i));
    const rowLabels = labels ?? Array.from({ length: n }, (_, i) => String(i));

    if (colLabels.length !== n || rowLabels.length !== n) {
        throw new Error("labels must have the same length as the matrix size");
    }

    // Longest row label determines where we put the first '|'
    const maxRowLabelLen = rowLabels.reduce(
        (m, l) => Math.max(m, l.length),
        0
    );

    // Each column’s width is at least the length of the column label, but also at least 1
    const colWidths = colLabels.map(l => Math.max(l.length, 1));

    // 1) Header
    // prefix = spaces up to where row data will start: longest label + " | " (3 chars)
    const headerPrefix = " ".repeat(maxRowLabelLen + 3);
    const headerCols = colLabels
        .map((l, i) => l.padEnd(colWidths[i], " "))
        .join(" ");
    const headerLine = headerPrefix + headerCols;

    // 2) Rows
    const rows = adj.map((row, rIdx) => {
        const label = rowLabels[rIdx].padEnd(maxRowLabelLen, " ");
        const cells = row
            .map((val, cIdx) => String(val).padEnd(colWidths[cIdx], " "))
            .join(" ");
        return `${label} | ${cells} |`;
    });

    return [headerLine, ...rows].join("\n");
}

export const printIntegerTuple = (arr: readonly number[]): string => {
    return `(${arr.join(", ")})`;
}