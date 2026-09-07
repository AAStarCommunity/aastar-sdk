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
  // #390 review, [Low] 2 — registered in the SAME PR that introduced it, per §9.1.
  // That review also named the sharper half: this PR REPLACED a prescription (the old
  // 「采样频率低于事件寿命…」 went out as this one came in) and NEITHER was on this list,
  // so the guard was silent about a swap, not merely about an addition. A list that can
  // only see deletions of things it already knows about cannot see a substitution at all.
  { phrase: '一次落空的采样', from: '#390 — 空集分不开「窗口没覆盖」和「量具看不见」' },
  // #396 — registered in the SAME PR that introduces it, per §9.1. (No FU number: this is a
  // delivered prescription, not a follow-up. An earlier draft of this line cited "FU-84", which
  // does not exist — inventing a ledger reference inside the PR that adds a rule against
  // unestablished claims.)
  { phrase: '不是上一版的 finding 列表', from: '#396 — 复审只核上一轮清单会放过这一版新造的每一句话' },
  // Registered in the SAME PR that introduces them, per §9.1. One phrase per prescription, not
  // one per section: a section can be rewritten around an intact prescription, and vice versa.
  { phrase: '自洽正是让人停下来的那个信号', from: '#405/#406 — 五种「测了但没测到」的共同形状' },
  { phrase: '变异必须打在两条路径的分歧处', from: '#405 — 打在公共祖先上的变异证明不了两条路径是同一条' },
  { phrase: '标量读数不可对账', from: '#404/#406 — 补坐标解决不了，可对账的是集合差或 delta' },
  { phrase: '先打一句「已落地」的显式回执', from: '#401 — 变异没落地的三种形态，可读性差得很远（第三种由 #406 复审贡献）' },
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

  // §9.1, applied to this registry itself: it had no floor on its own size.
  //
  // Measured: deleting one entry gives `Tests 15 passed` — zero red. The total moves in vitest's
  // summary line, and that is the line nobody reads, so **a prescription can be removed together
  // with the guard that was watching it, silently**. The document-length floor below is alive
  // (truncating to 3000 chars gives 14 failed) but its headroom is 22654 vs 4000 — 5.7x — so it
  // only catches the file being gutted, not an entry going missing.
  //
  // The literal is WRITTEN OUT, not derived from `PRESCRIPTIONS.length`. That is the thing #405
  // r3/r4 paid for twice: a threshold expressed relative to the quantity it guards pins the
  // direction of the comparison and nothing about its magnitude.
  //
  // 14, and getting that number wrong was instructive: the first draft said 15, taken from
  // `grep -c 'phrase:'` — which also counts the destructuring in the loop below and the word inside
  // a message template. **A proxy for a count is not the count**, and the assertion caught it
  // immediately (`expected 14 to be greater than or equal to 15`).
  it('the registry itself only grows — deleting a prescription must not be silent', () => {
    expect(
      PRESCRIPTIONS.length,
      'A prescription was removed. Each one was bought by a specific failure; deleting the entry ' +
        'also deletes the only thing checking that its rule is still in the document. Raise this ' +
        'floor when adding, never lower it to make a red go away.',
    ).toBeGreaterThanOrEqual(14);
  });

  it('the document still exists and is substantial', () => {
    // Instrument check: `toContain` on an empty string fails, but on a truncated file the individual
    // phrase assertions would fail one by one with no hint that the file itself was the problem.
    expect(doc.length).toBeGreaterThan(4000);
    expect(doc).toMatch(/^# verification/);
  });
});
