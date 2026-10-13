#!/usr/bin/env node
/**
 * Sandwich Dev —— 项目骨架初始化
 * 用法：node init.mjs [目标目录]
 * 在目标目录生成 docs/ 全套骨架（charter / PRD / state.json / reqs / tasks）
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const target = path.resolve(process.argv[2] || '.');
const tplDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'templates');
for (const d of ['docs', 'docs/reqs', 'docs/tasks']) {
  fs.mkdirSync(path.join(target, d), { recursive: true });
}
const tpl = (f) => fs.readFileSync(path.join(tplDir, f), 'utf8');
const writeIfAbsent = (rel, content) => {
  const p = path.join(target, rel);
  if (fs.existsSync(p)) { console.log('跳过（已存在）:', rel); return; }
  fs.writeFileSync(p, content, 'utf8');
  console.log('生成:', rel);
};

const today = new Date().toISOString().slice(0, 10);
const name = path.basename(target);

writeIfAbsent('docs/charter.md', `# ${name} 项目章程\n\n> Kickoff 追问产物（${today}）。假设项均已标注，可推翻。\n\n## 一句话定位\n\n{给谁、解决什么、凭什么}\n\n## 目标用户与核心场景\n\n- {用户}\n- {场景}\n\n## 成功标准\n\n- {可验证的标准}\n\n## 边界（不做什么）\n\n- {明确排除项}\n\n## 技术约束\n\n- {技术栈/部署/成本约束}\n\n## 假设（可推翻）\n\n- {kickoff 时问不到、按合理假设先走的项}\n`);
writeIfAbsent('docs/PRD.md', tpl('PRD-template.md').replaceAll('{产品名}', name));
writeIfAbsent('docs/state.json', JSON.stringify({
  project: name,
  updated: today,
  tasks: {},
  active: ['kickoff：对 charter.md 中的假设逐项与用户确认'],
  checkpoint: `项目刚初始化（${today}）。第一步：与用户过 charter.md 假设，然后写第一个 REQ。`,
  history: [{ ts: today, event: '项目骨架初始化（Sandwich Dev）' }],
}, null, 2) + '\n');
writeIfAbsent('docs/reqs/REQ-001-短名.md', tpl('REQ-template.md').replaceAll('{NNN}', '001'));
writeIfAbsent('docs/reqs/REQ-001.acceptance.json', tpl('acceptance.template.json').replaceAll('{NNN}', '001'));

console.log(`\n✓ ${name} 骨架就绪。下一步：和用户过 charter 假设 → 定稿 REQ-001。`);
