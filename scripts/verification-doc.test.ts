/**
 * The prescriptions `verification.md` is supposed to carry — listed HERE, outside the document.
 *
 * WHY THE LIST LIVES OUTSIDE
 * --------------------------
 * A previous version of this check grepped the document for phrases taken from the document. That is
 * the tautology this repo already found once (#337): the two sides of the comparison came from the
 * same place, so it could only fail if grep itself broke. Review named it again here.
 *
 * With the list in this file, deleting a prescription from the document turns this red. That is a
 * real property and a narrow one — stated plainly rather than dressed up:
 *
 *   it CATCHES     a prescription silently disappearing from the doc
 *   it does NOT catch a prescription that was never added — adding one means adding it to both
 *                    places, and nothing forces the second
 *
 * The second half is why this exists at all: the claim "I added it to §6" was made, believed, and
 * false (#360 review caught it with one grep). This does not prevent that claim; it makes the next
 * one cheap to check, and it makes the deletion case impossible.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const DOC = 'docs/agent/verification.md';

/** One line per prescription: the phrase that must appear, and where it came from. */
const PRESCRIPTIONS: { phrase: string; from: string }[] = [
  { phrase: '被解析 / 被调用 / 被求值', from: '#359 — 禁止某物存在的断言要数「生效」不是「出现」' },
  { phrase: '风险最高的一次应用', from: '#360 — 引入一条判据的 PR 必须先用在自己身上' },
  { phrase: '人工恢复步骤', from: '#352 — 撤变异/解冲突/超时清理是没有守卫的一格' },
  { phrase: '相关但不同', from: '#357 — 用来测量坐标的东西未必就是那个坐标' },
  { phrase: '先问矛盾，再问权衡', from: '#358 — 矛盾比权衡容易判断，且不可被新论据推翻' },
  { phrase: '便利包装不是机械强制层', from: '#349/FU-41 — required_status_checks 未启用' },
  { phrase: '把人推向错误', from: '#360 — 门禁最坏的失败方式' },
  { phrase: '环境此刻造不出这个区别', from: '#347 — 变异不红的第三类成因' },
];

describe('verification.md carries the prescriptions it was written for', () => {
  const doc = readFileSync(DOC, 'utf8');

  it.each(PRESCRIPTIONS)('$phrase — $from', ({ phrase }) => {
    expect(doc, `"${phrase}" is missing from ${DOC}`).toContain(phrase);
  });

  it('every prescription cites a PR, and every cited PR number is plausible', () => {
    // A prescription with no origin is the thing this document warns about in its own first line.
    for (const { phrase, from } of PRESCRIPTIONS) {
      expect(from, `${phrase} has no source`).toMatch(/#\d+|FU-\d+/);
    }
  });

  it('the document still exists and is substantial', () => {
    // Instrument check: `toContain` on an empty string fails, but on a truncated file the individual
    // phrase assertions would fail one by one with no hint that the file itself was the problem.
    expect(doc.length).toBeGreaterThan(4000);
    expect(doc).toMatch(/^# verification/);
  });
});
