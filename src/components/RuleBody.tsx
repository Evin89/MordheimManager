/**
 * A rule entry's body text: paragraphs separated by blank lines, where a
 * paragraph made entirely of `| a | b |` lines is a table.
 *
 * Reference data comes from PDFs, and a table pasted out of a PDF collapses
 * into one run of characters — the Human Warrior glossary entry read
 * "MWSBSSTWIALdHuman433331317". Writing such tables as pipe rows in the data
 * and drawing them here keeps them legible, in the same frame as the statline
 * (ProfileBlock), so a profile in the rules reads like a profile on a roster.
 *
 * The first row is the header; a markdown separator row (`|---|---|`) is
 * optional and skipped. The first column is treated as the row label.
 */

type Block = { kind: 'text'; text: string } | { kind: 'table'; head: string[]; rows: string[][] };

const isTableLine = (line: string) => /^\s*\|.*\|\s*$/.test(line);
const isSeparator = (cells: string[]) => cells.every((c) => /^:?-{2,}:?$/.test(c));

function splitRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
}

export function parseRuleBody(body: string): Block[] {
  return body
    .split('\n\n')
    .filter((p) => p.trim().length > 0)
    .map((paragraph): Block => {
      const lines = paragraph.split('\n').filter((l) => l.trim().length > 0);
      if (lines.length >= 2 && lines.every(isTableLine)) {
        const [head, ...rest] = lines.map(splitRow);
        return { kind: 'table', head, rows: rest.filter((r) => !isSeparator(r)) };
      }
      return { kind: 'text', text: paragraph };
    });
}

export default function RuleBody({ body, className = '' }: { body: string; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`}>
      {parseRuleBody(body).map((block, i) =>
        block.kind === 'text' ? (
          <p key={i} className="text-bone-200 text-sm whitespace-pre-line leading-relaxed">
            {block.text}
          </p>
        ) : (
          // Nine stat columns plus a label can outgrow a phone; scroll the
          // table, never the page.
          <div key={i} className="overflow-x-auto">
            <div className="inline-block min-w-full border-2 border-ink bg-parchment-raised ring-1 ring-inset ring-ink/35">
              <table className="w-full border-collapse tabular-nums lining-nums">
                <thead>
                  <tr>
                    {block.head.map((cell, c) => (
                      <th
                        key={c}
                        scope="col"
                        className={`font-heading-sc text-ink border-b-2 border-ink font-normal uppercase tracking-[0.05em] text-stat-min px-1 py-1 sm:px-3 sm:py-1.5 ${
                          c === 0 ? 'text-left !px-2 sm:!px-3' : ''
                        }`}
                      >
                        {cell}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {block.rows.map((row, r) => (
                    <tr key={r} className={r > 0 ? 'border-t border-ink/25' : ''}>
                      {row.map((cell, c) =>
                        c === 0 ? (
                          <th
                            key={c}
                            scope="row"
                            className="font-ui text-ink text-left text-sm font-semibold px-2 py-1.5 sm:px-3 whitespace-nowrap"
                          >
                            {cell}
                          </th>
                        ) : (
                          <td key={c} className="font-body text-ink text-center text-stat-min px-1 py-1.5 sm:px-3">
                            {cell}
                          </td>
                        ),
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ),
      )}
    </div>
  );
}
