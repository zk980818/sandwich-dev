# TASK-025 实体级业务流隔离与实体大盘二级页

**REQ**: REQ-012（实体级 GEO，第三口径之业务流全链实体化 + 实体分数二级页）
**日期**: 2026-10-09
**状态**: verified

## 实现范围

在 TASK-024 数据底座上，把词表/知识库/题库/采样/诊断全链按 entity_id 隔离，并新增实体大盘二级页（GEO 分/趋势/竞品对照/逐题明细）；品牌大盘主视图保持品牌级聚合。

### 1. 数据层（server/db.js，v1.7 + v1.7b 迁移，幂等）

- v1.7：`diagnosis`、`judgement` 加列 entity_id（NOT NULL DEFAULT 0），旧报告/判定回填到各品牌默认实体（judgement 无 brand_id 列，经 sample→question JOIN 定位）。
- v1.7b：brand_word 表重建，唯一约束 `UNIQUE(brand_id,type,word)` 升级为 `UNIQUE(brand_id,entity_id,type,word)`——实体级词表允许跨实体同名词，旧约束会跨实体吞词（实测 PUT 7 词仅落 3 条后修复）。

### 2. GEO 分（server/lib/geoscore.js，新库）

- `geoScore(p, officialRate)` = mention_rate×40% + positive_rate×20% + first_rank_rate×20% + official_rate×20%，输出 0~100 整数；`officialHost(url)` 域名提取。

### 3. 路由实体化（五路由）

- **entities.js**：`resolveEntity(brandId, entityIdRaw)` 回退语义（缺省取 ORDER BY id LIMIT 1 默认实体，兼容旧 API）；`latestScore(brandId, entityId, website)`；GET /entities 加 latest_score/latest_date；实体词表 GET/PUT /entities/:id/words；DELETE 实体级联补 judgement/diagnosis 清理（`entity_id = ? OR sample_id IN (...)`）。
- **knowledge.js**：实体知识库四端点 /entities/:id/knowledge（GET 含 counts/dim_names，intro 虚拟自 entity.description）。
- **questions.js**：全链实体化——生成 job 防重入按实体（detail.entity_id 匹配）；genOneLayer 层级删除三连（judgement 用 OR 子查询）；genUserMsg 用实体词表+`knowledgeTextE`（空则回退品牌知识），`buildUserMessage({name: entity.name, introduction: entity.description}, ...)`——实体生成时品牌名上下文注入换成实体名，行业词过滤 `!q.includes(entity.name)`；POST /generate、GET /generate/progress、POST /generate/layer、GET/POST /questions 全部带 entity_id。
- **sampling.js**：runSampler 按 `q.entity_id = ?` 过滤；POST /sample/start / GET /sample/progress 实体化。
- **diagnosis.js**：判定对象/诊断提示词换实体名；judgement 认领/统计按 entity_id；`competitorStats` 程序化竞品对照（name+alias 分词、长度≥2、answer_text 文本出现统计，零 LLM 成本）写入 report.competitors；report 加 entity_id/entity_name/spec_version v2.1；runningDiag key 三元组 brandId:entityId:date。
- **dashboard.js**：GET /dashboard 加 entity_id 参数（实体级视图）；byDate 键改 `entity_id|date`；品牌级同日多实体 GEO 分取均值作 trend；响应新增 entity_id/geo_score/trend/entities（各实体最新分）/latest（实体视图含 competitors/details/engines）。

### 4. 前端（app.html / app.js）

- 实体选择器三处：生成页 #ent-select / 采样页 #ent-select2 / 诊断页 #ent-select3；state.entityId/entityName + eidQS()/eidBody()；品牌切换重置实体。
- 实体卡片升级：最新 GEO 分徽标（escore）+ 入口按钮（题库/诊断/大盘/词表/删除）；entGoto(page, eid) 跨页跳转；entWords prompt 链式编辑实体词表。
- 大盘二级页：#db-back 返回品牌大盘；#db-entities 实体分列表（品牌视图）；实体视图 GEO 分卡 + 按日趋势柱状 + 最新一轮诊断明细（竞品对照 + 逐题明细 + 引擎徽标）。
- 生成/采样/诊断页轮询与渲染实体化（progress 响应带 entity_name 展示）。

## 自验记录（本地 3721，brand 7 徕芬，真实 key 池）

1. v1.7 迁移：3 份旧报告（9-21~9-23）全部回填 entity_id=1 ✓
2. v1.7b 迁移：日志 "brand_word unique constraint upgraded"，实体 4 词表 PUT 7 词全落库（含与实体 1 同名的"高速吹风机"等）✓
3. S3 生成：新建实体「徕芬高速吹风机SE」（#4）→ POST /generate（entity_id=4）→ 六层全 done，25 题落库；题面含实体名（如"徕芬高速吹风机SE质量怎么样"）；实体 1 与实体 4 各 25 题互不干扰 ✓
4. S4 采样：POST /sample/start（entity_id=4）→ 50 样本（25 题 × deepseek/doubao）→ progress 响应带 entity_name ✓
5. S5 诊断：POST /diagnose?entity_id=4 → 报告 entity_id=4、spec_version v2.1、competitors 程序化统计 ✓
6. S6 大盘：GET /dashboard?entity_id=4 → geo_score/趋势/latest（竞品对照+逐题明细）；品牌视图 entities 数组含两实体最新分 ✓
7. 前端截图（Puppeteer + Edge，PAGE-ERRORS: []）：实体与竞品页（卡片徽标+按钮组+竞品空态）、生成/采样/诊断页选择器、大盘品牌视图、实体二级页（近 30 天：GEO 分 61 + 3 天趋势 32/62/61 + 逐题明细含提及/情感/位次/引擎徽标）✓
8. 回归：实体 1 既有题库 25 题/词表 6 词/知识库 0/最新分 61 完好 ✓

## 备注

- 实体无词表时生成明确报错引导（"该实体无词表，请先在实体卡片上维护词表"）。
- advise/workshop（建议撰稿/文章工坊）本任务不动：仍品牌级聚合所有实体数据，可接受；实体化归后续任务。
- 竞品对照为文本出现统计口径（参考腾讯 AnswerBit 结构化对照组思路），命中数不代表位次，仅作同屏对照展示。
- 成本口径：实体完全独立（每实体独立题库 25 题/采样/诊断），成本随实体数线性增长，用户已知悉（REQ-012 定稿口径 A）。
