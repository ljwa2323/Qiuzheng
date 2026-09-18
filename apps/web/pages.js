import { highlightEvidenceHtml } from './core.js';

export function createPages(ctx) {
  const {
    state, icon, escapeHtml, header, titleMap, matchesQuery,
    currentScreenCase, includedForFulltext, includedAfterFulltext, screeningConflicts,
    recomputeDerivedCounts, moduleCount, robJudgement, robQuestionContext, sourceSentences,
    extractionValue,
  } = ctx;

  const extractionTypeLabels = { text: '文本', number: '数值', boolean: '是/否', select: '单选', date: '日期' };

  /** Strip display suffix like " [MeSH]" so PubMed gets "Term"[Mesh], not "Term [MeSH]"[Mesh]. */
  function controlledHeading(term = '') {
    return String(term)
      .replace(/\s*\[?\s*MeSH\s*Terms?\s*\]?\s*$/i, '')
      .replace(/\s*\[?\s*MeSH\s*\]?\s*$/i, '')
      .replace(/^["']|["']$/g, '')
      .trim();
  }

  function taskRow(ic, color, title, desc, count, nav) {
    return `<div class="task-row" data-nav="${nav}"><div class="task-symbol badge ${color}">${icon(ic)}</div><div class="task-copy"><strong>${title}</strong><span>${desc}</span></div><div class="task-count">${count}</div>${icon('chevron')}</div>`;
  }
  function activity(initial, text, detail, time) {
    return `<div class="activity"><div class="activity-avatar">${initial}</div><div><p>${text}</p><small>${detail}</small></div><time>${time}</time></div>`;
  }
  function reviewer(initial, role, decision, reason, quote, color) {
    return `<article class="reviewer-card"><div class="reviewer-head"><div class="avatar">${initial}</div><div><strong>${role}</strong><small>Independent decision</small></div></div><div class="reviewer-decision">${escapeHtml(decision || '')}</div><span class="badge ${color}">${decision === 'Include' ? '纳入' : decision === 'Exclude' ? '排除' : '待定'}</span><p>${escapeHtml(reason || '')}</p><div class="quote">${escapeHtml(quote || '')}</div></article>`;
  }

  function dashboard() {
    recomputeDerivedCounts();
    const totalCitations = state.citationsTotal || state.citations.length || state.screeningQueue.length;
    const screeningRemaining = Math.max(0, totalCitations - state.screeningCompleted);
    const protocolReady = state.criteria.length > 0 && state.question;
    const stats = [
      ['待筛选', String(screeningRemaining), '题目摘要队列', 'alert', 'amber'],
      ['文献总量', String(totalCitations), '服务端持久化', 'library', 'blue'],
      ['已配置模型', state.credentialId ? '是' : '否', state.user?.email || '', 'spark', 'green'],
      ['初筛冲突', String(state.adjudicationRemaining), '待裁决', 'users', 'red'],
    ];
    const afterFulltext = includedAfterFulltext().length;
    const workflow = [
      ['方案', protocolReady ? '已就绪' : '待完善', protocolReady ? 'done' : '', 'protocol'],
      ['检索', `${state.concepts.length} 个概念`, state.concepts.length ? 'done' : '', 'search'],
      ['初筛', screeningRemaining ? `剩余 ${screeningRemaining}` : (totalCitations ? '已完成' : '无文献'), screeningRemaining ? 'active' : '', 'screening'],
      ['裁决', state.adjudicationRemaining ? `待决 ${state.adjudicationRemaining}` : '无冲突', state.adjudicationRemaining ? 'active' : (screeningRemaining ? '' : 'done'), 'adjudication'],
      ['全文', includedForFulltext().length ? `待审 ${includedForFulltext().length}` : (afterFulltext ? '已完成' : '等待初筛'), includedForFulltext().length ? 'active' : '', 'fulltext'],
      ['提取', afterFulltext ? `${afterFulltext} 篇可提取` : '等待全文纳入', afterFulltext ? '' : '', 'extraction'],
      ['Meta', state.metaAnalyses?.length ? `${state.metaAnalyses.length} 个分析` : '待建立', state.metaAnalyses?.length ? '' : '', 'meta'],
      ['综合', afterFulltext || state.metaAnalyses?.length ? '可召回知识' : '等待上游', '', 'synthesis'],
    ];
    return `${header('Review control center', `你好，${escapeHtml(state.user?.name || '')}`, '所有数字均来自当前项目的服务端数据。', `<button class="ghost-button" data-action="export">${icon('download')} 导出状态</button><button class="primary-button" data-nav="screening">继续筛选 ${icon('arrow')}</button>`)}
    <div class="stats-grid">${stats.map(([label, value, meta, ic, c]) => `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon badge ${c}">${icon(ic)}</span></div><div class="stat-value">${value}</div><div class="stat-meta">${meta}</div></article>`).join('')}</div>
    <div class="grid-2">
      <section class="panel"><div class="panel-head"><div><h3>综述进度</h3><p>基于当前项目真实状态</p></div></div><div class="panel-body"><div class="workflow">
        ${workflow.map((x, i) => `<div class="workflow-step ${x[2]}" data-nav="${x[3]}"><div class="step-dot">${x[2] === 'done' ? icon('check', 13) : i + 1}</div><strong>${x[0]}</strong><small>${x[1]}</small></div>`).join('')}
      </div></div></section>
      <section class="panel"><div class="panel-head"><div><h3>模型服务</h3><p>用户自备 API Key · OpenAI 兼容（含 NVIDIA）</p></div><button class="link-button" data-action="settings">配置</button></div><div class="panel-body"><p class="muted" style="font-size:12px;line-height:1.6">当前凭据：${state.credentialId ? escapeHtml(state.credentials.find((c) => c.id === state.credentialId)?.name || state.credentialId) : '未配置'}。密钥仅保存在服务端加密存储。</p></div></section>
    </div>
    <div class="grid-2">
      <section class="panel"><div class="panel-head"><div><h3>需要你处理</h3><p>按当前队列统计</p></div><button class="link-button" data-nav="screening">查看筛选</button></div><div class="panel-body task-list">
        ${taskRow('alert', 'amber', '题目摘要初筛', '尚未提交人工判断的记录', screeningRemaining, 'screening')}
        ${taskRow('users', 'red', '初筛冲突裁决', '双人 Diff 或人机判断不一致', state.adjudicationRemaining, 'adjudication')}
        ${taskRow('file', 'blue', '全文待处理', '已纳入但全文未齐', state.fulltextRemaining, 'fulltext')}
        ${taskRow('history', 'green', '审计记录', '服务端操作轨迹', state.audits.length, 'audit')}
      </div></section>
      <section class="panel"><div class="panel-head"><div><h3>最近活动</h3><p>来自 AuditEvent</p></div><button class="link-button" data-nav="audit">完整日志</button></div><div class="panel-body activity-list">
        ${(state.audits.slice(0, 4).map((e) => activity((e.actor || '?').slice(0, 2), e.action, e.detail, e.time)).join('')) || '<p class="muted">暂无审计事件。开始筛选或导入后会自动写入。</p>'}
      </div></section>
    </div>`;
  }

  function protocol() {
    const versionLabel = state.protocolVersion ? `Protocol v${state.protocolVersion}` : 'Protocol';
    const pico = state.pico || { p: '', i: '', c: '', o: '' };
    const picoRows = [
      ['P', 'Population / 人群', pico.p],
      ['I', 'Intervention / 干预', pico.i],
      ['C', 'Comparator / 对照', pico.c],
      ['O', 'Outcome / 结局', pico.o],
    ];
    return `${header(versionLabel, '研究问题与纳入排除标准', '先抽取 PICO，再据此生成纳入排除标准；修改后会创建新版本并写入审计。', `<button class="ghost-button" data-action="history">${icon('history')} 版本历史</button><button class="primary-button" data-action="add-criterion">${icon('plus')} 添加标准</button>`)}
    <section class="panel"><div class="panel-head"><div><h3>主要研究问题</h3></div><button class="link-button" data-action="edit-question">编辑</button></div><div class="panel-body"><p style="line-height:1.6">${escapeHtml(state.question || '尚未填写研究问题')}</p></div></section>
    <section class="panel" style="margin-top:16px"><div class="panel-head"><div><h3>PICO</h3><p>可由 AI 抽取，也可人工修改；抽不到则留空</p></div><button class="link-button" data-action="edit-pico">编辑</button></div><div class="panel-body pico-grid">${picoRows.map(([code, label, value]) => `<div class="pico-card"><div class="pico-card-head"><span class="pico-badge">${code}</span><strong>${escapeHtml(label)}</strong></div><p>${value ? escapeHtml(value) : '<span class="muted">（空）</span>'}</p></div>`).join('')}</div></section>
    <div class="criteria-list" style="margin-top:16px">${state.criteria.length ? state.criteria.map((item) => `<section class="panel criterion-card"><div class="panel-head"><div><span class="criterion-id">${escapeHtml(item.id)}</span><strong>${escapeHtml(item.title)}</strong></div><button class="icon-button" data-action="edit-criterion" data-id="${escapeHtml(item.id)}">${icon('edit')}</button></div><div class="panel-body criteria-columns"><div><h4>纳入</h4>${(item.include || []).map((t) => `<div class="criterion-line">${icon('check')}<span>${escapeHtml(t)}</span></div>`).join('') || '<p class="muted">无</p>'}</div><div><h4>排除</h4>${(item.exclude || []).map((t) => `<div class="criterion-line">${icon('x')}<span>${escapeHtml(t)}</span></div>`).join('') || '<p class="muted">无</p>'}</div></div></section>`).join('') : '<div class="empty-state"><p>暂无纳入排除标准。可先抽取 PICO，再生成标准草案。</p></div>'}</div>`;
  }

  function searchPage() {
    const dbs = ['PubMed', 'Embase', 'Web of Science', 'CENTRAL'];
    const compileConcept = (c, db) => {
      const free = (c.free || []).filter(Boolean);
      const controlled = (c.controlled || []).filter(Boolean);
      if (db === 'PubMed') {
        const freePart = free.map((t) => `"${t}"[tiab]`).join(' OR ');
        const meshPart = controlled
          .map((t) => controlledHeading(t))
          .filter(Boolean)
          .map((t) => `"${t}"[Mesh]`)
          .join(' OR ');
        return `(${[meshPart, freePart].filter(Boolean).join(' OR ') || '""'})`;
      }
      if (db === 'Embase') {
        const freePart = free.map((t) => `'${t}'`).join(' OR ');
        const emtree = controlled
          .map((t) => controlledHeading(t))
          .filter(Boolean)
          .map((t) => `'${t}'/exp`)
          .join(' OR ');
        return `(${[emtree, freePart].filter(Boolean).join(' OR ') || "''"})`;
      }
      if (db === 'Web of Science') {
        const terms = (free.length ? free : controlled.map(controlledHeading).filter(Boolean));
        return `TS=(${terms.map((t) => `"${t}"`).join(' OR ') || '""'})`;
      }
      return `(${(free.length ? free : controlled.map(controlledHeading).filter(Boolean)).join(' OR ') || '""'})`;
    };
    const query = state.concepts.length
      ? state.concepts.map((c) => compileConcept(c, state.db)).join('\nAND\n')
      : '（请先添加概念，或让 AI 根据研究问题生成策略草稿）';
    const logicPreview = state.concepts.length
      ? state.concepts.map((c) => escapeHtml(c.title || c.index)).join(' <span class="logic-op">AND</span> ')
      : '尚未拆分概念';
    const questionBlock = state.question
      ? `<div class="search-question"><span class="eyebrow">研究问题</span><p>${escapeHtml(state.question)}</p><p class="muted" style="margin:8px 0 0;font-size:11px">只读；请在「方案」模块修改</p></div>`
      : `<div class="search-question empty"><p>还没有研究问题。请先到「方案」模块填写，再回到这里拆成可检索的概念块。</p><button class="primary-button" data-nav="protocol">前往方案</button></div>`;

    const conceptCards = state.concepts.length
      ? state.concepts.map((c, idx) => {
        const selected = (state.searchConceptId || state.concepts[0]?.id) === c.id;
        return `<article class="concept-card ${selected ? 'selected' : ''}" data-select-concept="${c.id}">
          <div class="concept-head">
            <span class="concept-index">#${idx + 1}</span>
            <strong>${escapeHtml(c.title)}</strong>
            <span class="muted">块内 OR · 块间 AND</span>
            <button class="link-button" data-action="add-term" data-id="${c.id}">加同义词</button>
            <button class="icon-button danger concept-delete" data-action="remove-concept" data-id="${c.id}" aria-label="删除概念块" title="删除概念块">${icon('x')}</button>
          </div>
          <div class="concept-body">
            ${`<div><small class="term-label">受控词 / MeSH</small><div class="chips">${(c.controlled || []).length ? c.controlled.map((t, i) => `<button class="chip controlled" data-action="remove-controlled" data-id="${c.id}" data-index="${i}" title="移除受控词">${escapeHtml(t)} <span aria-hidden="true">x</span></button>`).join('') : '<span class="muted">暂无；可用 AI「映射 MeSH」根据自由词生成</span>'}</div></div>`}
            <div><small class="term-label">自由词 / 同义词</small><div class="chips">${(c.free || []).length ? c.free.map((t, i) => `<button class="chip" data-action="remove-term" data-id="${c.id}" data-index="${i}">${escapeHtml(t)} <span aria-hidden="true">x</span></button>`).join('') : '<span class="muted">暂无词，可手动添加或让 AI 补词</span>'}</div></div>
          </div>
        </article>`;
      }).join('')
      : '<div class="empty-state"><p>还没有概念块。用「AI 生成检索策略」从研究问题起草，或手动添加概念。</p></div>';

    return `${header(
      'Generate searchable queries',
      '生成检索策略',
      '把研究问题拆成概念块，块内同义词用 OR，块与块之间用 AND，再编译成可粘贴到数据库的检索式。AI 动作请在右侧协作面板操作。',
      `<button class="primary-button" data-action="save-search-strategy">${icon('check')} ${state.searchStrategyDirty ? '保存检索策略*' : '保存检索策略'}</button>`,
    )}
    <div class="search-steps">
      <div class="search-step"><span>1</span><div><strong>研究问题</strong><small>来自方案模块</small></div></div>
      <div class="search-step"><span>2</span><div><strong>概念块</strong><small>主题 / 干预 / 人群等</small></div></div>
      <div class="search-step"><span>3</span><div><strong>编译检索式</strong><small>复制到数据库执行</small></div></div>
    </div>
    ${state.searchStrategyUpdatedAt ? `<p class="muted" style="margin:0 0 12px;font-size:11px">服务端上次保存：${escapeHtml(new Date(state.searchStrategyUpdatedAt).toLocaleString('zh-CN'))}${state.searchStrategyDirty ? ' · 有未保存更改' : ''}</p>` : (state.searchStrategyDirty ? '<p class="muted" style="margin:0 0 12px;font-size:11px">尚未保存到服务端</p>' : '')}
    ${questionBlock}
    <div class="grid-2 search-layout">
      <section class="panel">
        <div class="panel-head">
          <div><h3>概念块</h3><p>逻辑：${logicPreview}</p></div>
          <button class="ghost-button" data-action="add-concept">${icon('plus')} 概念</button>
        </div>
        <div class="panel-body concept-list">${conceptCards}</div>
      </section>
      <section class="panel search-output">
        <div class="panel-head">
          <div><h3>生成的检索式</h3><p>切换数据库语法后一键复制</p></div>
          <button class="primary-button" data-action="copy-query">${icon('copy')} 复制</button>
        </div>
        <div class="panel-body">
          <div class="tabs">${dbs.map((db) => `<button class="tab ${state.db === db ? 'active' : ''}" data-db="${db}">${db}</button>`).join('')}</div>
          <pre class="code-box" id="compiled-query">${escapeHtml(query)}</pre>
          <ol class="search-next">
            <li>复制上方检索式，到 ${escapeHtml(state.db)} 执行</li>
            <li>导出命中结果（RIS / BibTeX / CSV）</li>
            <li>回到「文献管理」导入，继续去重与筛选</li>
          </ol>
        </div>
      </section>
    </div>`;
  }

  function library() {
    const sources = [...new Set(state.citations.map((c) => c.source).filter(Boolean))];
    const rows = state.citations.filter((c) => matchesQuery([c.title, c.authors, c.doi, c.abstract], state.libraryQuery))
      .filter((c) => state.librarySource === '全部来源' || c.source === state.librarySource)
      .filter((c) => state.libraryFullText === '全部全文状态' || (state.libraryFullText === '已获取' ? c.fullText === 'Full text' : c.fullText !== 'Full text'));
    const selected = state.selectedLibrary || [];
    const selectedVisible = rows.filter((c) => selected.includes(String(c.id)));
    const allVisibleSelected = rows.length > 0 && selectedVisible.length === rows.length;
    const someVisibleSelected = selectedVisible.length > 0 && !allVisibleSelected;
    return `${header('Citation library', '管理检索结果', '导入、清理误导入文献。全文上传请在「全文筛选」阶段进行。', `<button class="ghost-button danger-text" data-action="library-delete-selected" ${selected.length ? '' : 'disabled'}>${icon('x')} 删除所选 ${selected.length ? `(${selected.length})` : ''}</button><button class="primary-button" data-action="import">${icon('upload')} 导入</button>`)}
  <section class="panel"><div class="panel-head"><div><h3>全部文献</h3><p>${rows.length} 条当前记录${selected.length ? ` · 已选 ${selected.length}` : ''}</p></div><span class="badge green">服务端已保存</span></div><div class="panel-body"><div class="toolbar"><label class="filter-input">${icon('search')}<input data-filter="library-query" value="${escapeHtml(state.libraryQuery)}" placeholder="按题目、作者、摘要、DOI 搜索" aria-label="搜索文献" /></label><select class="select" data-filter="library-source" aria-label="按来源筛选">${['全部来源', ...sources].map((value) => `<option ${state.librarySource === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select><select class="select" data-filter="library-fulltext" aria-label="按全文状态筛选">${['全部全文状态', '已获取', '缺失'].map((value) => `<option ${state.libraryFullText === value ? 'selected' : ''}>${value}</option>`).join('')}</select><span class="spacer"></span>${selected.length ? `<button class="ghost-button" data-action="library-clear-selection">取消全选</button>` : ''}<button class="ghost-button" data-action="export-library">${icon('download')} 导出</button></div></div><div class="table-wrap"><table><thead><tr><th class="check-col"><input type="checkbox" data-library-all ${allVisibleSelected ? 'checked' : ''} ${someVisibleSelected ? 'data-indeterminate="true"' : ''} aria-label="全选当前列表"></th><th>文献与摘要</th><th>首个来源</th><th>命中</th><th>全文状态</th><th></th></tr></thead><tbody>${rows.length ? rows.map((c) => {
      const abstractText = c.abstract || c.raw?.abstract || '';
      const abstractPreview = abstractText ? (abstractText.length > 220 ? `${abstractText.slice(0, 220)}…` : abstractText) : '无摘要';
      const fullOk = c.fullText === 'Full text' || c.hasMd;
      const checked = selected.includes(String(c.id));
      return `<tr class="${checked ? 'is-selected' : ''}"><td class="check-col"><input type="checkbox" data-library-select="${c.id}" ${checked ? 'checked' : ''} aria-label="选择文献"></td><td class="title-cell wide"><strong>${escapeHtml(c.title)}</strong><small>${escapeHtml(c.authors)}</small><p class="abstract-preview">${escapeHtml(abstractPreview)}</p></td><td>${escapeHtml(c.source)}</td><td>${c.hits}</td><td><span class="badge ${fullOk ? 'green' : c.hasPdf ? 'blue' : 'amber'}">${escapeHtml(c.fullText)}</span>${c.hasPdf ? '<small class="ai-meta">PDF</small>' : ''}${c.hasMd ? '<small class="ai-meta">MD</small>' : ''}</td><td class="row-actions"><button class="icon-button danger" data-action="library-delete-one" data-id="${c.id}" aria-label="删除文献">${icon('x')}</button><button class="icon-button" data-action="citation-more" data-id="${c.id}" aria-label="查看详情">${icon('more')}</button></td></tr>`;
    }).join('') : `<tr><td colspan="6"><div class="empty-state"><p>暂无文献</p></div></td></tr>`}</tbody></table></div></section>`;
  }

  function screening() {
    if (state.screenMode === 'batch') return screeningBatch();
    const c = currentScreenCase();
    const remaining = moduleCount('screening');
    const abstractText = c.abstract || '';
    const showAi = Boolean(state.decision || c.humanDecision);
    const hasAi = Boolean(c.ai && c.ai !== '—');
    const aiPanel = showAi && hasAi
      ? `<section class="ai-reveal-card"><header><strong>AI 判断（已揭盲）</strong><span class="badge ${c.ai === 'Include' ? 'green' : c.ai === 'Exclude' ? 'red' : 'amber'}">${escapeHtml(c.ai)}</span>${c.confidence && c.confidence !== '—' ? `<span class="badge gray">${escapeHtml(c.confidence)}</span>` : ''}</header><div class="ai-reveal-body"><div><h4>理由</h4><p>${escapeHtml(c.reason || '未返回理由')}</p></div>${c.evidence ? `<div><h4>原文证据</h4><blockquote class="evidence-quote">${escapeHtml(c.evidence)}</blockquote></div>` : ''}${c.criterion ? `<div><h4>相关标准</h4><p>${escapeHtml(c.criterion)}</p></div>` : ''}</div></section>`
      : (showAi
        ? '<section class="ai-reveal-card muted-card"><p class="muted">已提交人工判断；暂无 AI 结论（可在侧栏对本条再跑初筛 AI）。</p></section>'
        : '<section class="ai-reveal-card muted-card"><p class="muted">盲筛中：先根据摘要提交人工判断，提交后才会揭盲 AI 理由与证据。</p></section>');
    return `${header('Title and abstract screening', '题目与摘要初筛', '先阅读摘要并提交人工判断；提交后揭盲 AI 理由与证据。可用 Diff 导入第二位 reviewer 结果。', `<button class="ghost-button" data-action="export-screening-diff">${icon('download')} 导出 Diff</button><button class="ghost-button" data-action="import-screening-diff">${icon('upload')} 导入 Diff</button><div class="tabs"><button class="tab active" data-screen-mode="single">单篇模式</button><button class="tab" data-screen-mode="batch">批量模式</button></div>`)}
  <div class="screen-layout"><article class="citation-card"><div class="citation-meta"><span>Record ${state.screeningIndex + 1}/${Math.max((state.screeningQueue.length || state.citations.length), 1)}</span><span>${escapeHtml(c.authors)}</span><span>${escapeHtml(c.journal)}</span><span class="badge blue">${showAi ? (hasAi ? 'AI 已揭盲' : '仅人工') : 'Blind mode'}</span></div><div class="citation-main"><h3>${escapeHtml(c.title)}</h3><div class="abstract-block"><h4>摘要</h4><p>${abstractText ? escapeHtml(abstractText) : '<span class="muted">这条记录没有摘要，建议回文献库核对导入结果。</span>'}</p></div></div>${aiPanel}<div class="decision-bar"><div><div class="decision-group"><button class="decision-button include ${state.decision === 'Include' ? 'selected' : ''}" data-decision="Include" ${state.decision || !c.id ? 'disabled' : ''}>${icon('check')} 纳入</button><button class="decision-button exclude ${state.decision === 'Exclude' ? 'selected' : ''}" data-decision="Exclude" ${state.decision || !c.id ? 'disabled' : ''}>${icon('x')} 排除</button><button class="decision-button uncertain ${state.decision === 'Uncertain' ? 'selected' : ''}" data-decision="Uncertain" ${state.decision || !c.id ? 'disabled' : ''}>? 待定</button></div></div><div class="muted">剩余约 ${remaining} · 快捷键 1/2/3</div></div></article>
  <aside class="panel screening-protocol-tips"><div class="panel-head"><h3>当前方案提示</h3></div><div class="panel-body">${state.criteria.length ? state.criteria.map((item) => {
      const includeLines = (item.include || []).filter(Boolean);
      const excludeLines = (item.exclude || []).filter(Boolean);
      return `<section class="protocol-tip-block"><header><b>${escapeHtml(item.id)}</b> · ${escapeHtml(item.title)}</header>${includeLines.length ? `<div class="protocol-tip-group"><small>纳入</small>${includeLines.map((t) => `<div class="criterion-line">${icon('check')}<span>${escapeHtml(t)}</span></div>`).join('')}</div>` : ''}${excludeLines.length ? `<div class="protocol-tip-group"><small>排除</small>${excludeLines.map((t) => `<div class="criterion-line exclude">${icon('x')}<span>${escapeHtml(t)}</span></div>`).join('')}</div>` : ''}${!includeLines.length && !excludeLines.length ? '<p class="muted">暂无纳入/排除细则</p>' : ''}</section>`;
    }).join('') : '<p class="muted">无标准</p>'}</div></aside></div>`;
  }

  function screeningBatch() {
    const queue = state.screeningQueue.length ? state.screeningQueue : state.citations;
    const cases = queue.map((item) => {
      const ai = item.raw?.decisions?.find((d) => d.actor === 'ai');
      const abstractText = item.abstract || item.raw?.abstract || '';
      return {
        id: item.id,
        title: item.title,
        authors: item.authors,
        abstract: abstractText,
        ai: ai?.decision || '—',
        confidence: ai?.confidence || '—',
        criterion: (ai?.criterionIds || []).join(' · ') || '—',
        reason: ai?.rationale || '',
        evidence: ai?.evidence || '',
      };
    });
    const selectedCount = (state.selectedBatch || []).length;
    const allSelected = cases.length > 0 && selectedCount >= cases.length
      && cases.every((c) => (state.selectedBatch || []).includes(String(c.id)));
    const someSelected = selectedCount > 0 && !allSelected;
    return `${header('Title and abstract screening', '批量筛选', '列表展示摘要与 AI 理由，便于对照后提交人工判断。', `<button class="ghost-button" data-action="export-screening-diff">${icon('download')} 导出 Diff</button><button class="ghost-button" data-action="import-screening-diff">${icon('upload')} 导入 Diff</button><div class="tabs"><button class="tab" data-screen-mode="single">单篇模式</button><button class="tab active" data-screen-mode="batch">批量模式</button></div>`)}<section class="panel"><div class="panel-body"><div class="toolbar"><span class="muted">已选择 ${selectedCount} / ${cases.length} 条</span><span class="spacer"></span>${selectedCount ? `<button class="ghost-button" data-action="batch-clear-selection">取消全选</button>` : ''}<button class="ghost-button" data-action="batch-confirm" ${selectedCount ? '' : 'disabled'}>批量确认</button></div></div><div class="table-wrap"><table><thead><tr><th><input type="checkbox" data-batch-all aria-label="${allSelected ? '取消全选' : '全选'}" title="${allSelected ? '取消全选' : '全选'}" ${allSelected ? 'checked' : ''} ${someSelected ? 'data-indeterminate="true"' : ''}></th><th>文献与摘要</th><th>AI 判断 / 理由</th><th>人工判断</th></tr></thead><tbody>${cases.length ? cases.map((c) => {
      const preview = c.abstract ? (c.abstract.length > 260 ? `${c.abstract.slice(0, 260)}…` : c.abstract) : '无摘要';
      return `<tr><td><input type="checkbox" data-batch-select="${c.id}" ${(state.selectedBatch || []).includes(String(c.id)) ? 'checked' : ''}></td><td class="title-cell wide"><strong>${escapeHtml(c.title)}</strong><small>${escapeHtml(c.authors)}</small><p class="abstract-preview">${escapeHtml(preview)}</p><button type="button" class="link-button abstract-expand" data-action="citation-more" data-id="${c.id}">${icon('file', 14)} 查看完整标题与摘要</button></td><td class="ai-cell"><span class="badge ${c.ai === 'Include' ? 'green' : c.ai === 'Exclude' ? 'red' : c.ai === 'Uncertain' ? 'amber' : 'gray'}">${escapeHtml(c.ai)}</span>${c.confidence && c.confidence !== '—' ? `<small class="ai-meta">${escapeHtml(c.confidence)}</small>` : ''}<p class="ai-reason">${escapeHtml(c.reason || '暂无 AI 理由')}</p>${c.evidence ? `<p class="ai-evidence">${escapeHtml(c.evidence.length > 160 ? `${c.evidence.slice(0, 160)}…` : c.evidence)}</p>` : ''}</td><td><select class="select" data-batch-decision="${c.id}"><option value="">待处理</option>${[['Include', '纳入'], ['Exclude', '排除'], ['Uncertain', '待定']].map(([value, label]) => `<option value="${value}" ${state.batchDecisions[c.id] === value ? 'selected' : ''}>${label}</option>`).join('')}</select></td></tr>`;
    }).join('') : `<tr><td colspan="4"><div class="empty-state"><p>暂无文献。</p></div></td></tr>`}</tbody></table></div></section>`;
  }

  function fulltext() {
    const included = includedForFulltext();
    const citation = included[state.fulltextIndex || 0] || included[0];
    if (!citation) {
      return `${header('Full text screening', '全文证据核对', '仅展示题目摘要已纳入、且尚无全文终裁的记录。若有人机冲突请先裁决。')}<div class="empty-state">${icon('file')}<h3>暂无待审全文</h3><p>请先完成初筛纳入，并解决冲突裁决后再进行全文筛选。</p><button class="primary-button" data-nav="screening">去初筛</button><button class="ghost-button" data-nav="adjudication">去裁决</button></div>`;
    }
    const mdText = citation.fullTextMarkdown || citation.raw?.fullTextMarkdown || '';
    const sourceText = mdText || citation.abstract || citation.raw?.abstract || '';
    const activeCriterionId = state.fulltextEvidenceCriterionId || '';
    const criteriaRows = state.criteria.length
      ? state.criteria.map((item) => {
        const active = item.id === activeCriterionId;
        return `<button class="eligibility-row ${active ? 'is-active' : ''}" data-action="jump-evidence" data-id="${escapeHtml(item.id)}"><header><span class="status-symbol ${active ? 'pass' : 'warn'}">${active ? '✓' : '?'}</span><strong>${escapeHtml(item.id)} · ${escapeHtml(item.title)}</strong></header><p>${escapeHtml(item.include[0] || '对照方案标准核对原文')}</p></button>`;
      }).join('')
      : '<p class="muted">请先配置方案标准</p>';
    const hasPdf = Boolean(citation.hasPdf);
    const hasText = Boolean(sourceText.trim());
    let viewMode = state.fulltextViewMode === 'pdf' || state.fulltextViewMode === 'text'
      ? state.fulltextViewMode
      : (hasPdf ? 'pdf' : 'text');
    if (viewMode === 'pdf' && !hasPdf) viewMode = 'text';
    if (viewMode === 'text' && !hasText && hasPdf) viewMode = 'pdf';
    const highlightQuery = state.fulltextEvidenceQuery || '';
    const bodyHtml = highlightEvidenceHtml(sourceText, highlightQuery, {
      fullText: true,
      anchorId: 'fulltext-evidence-anchor',
    });
    const viewSwitch = (hasPdf && hasText)
      ? `<div class="module-switch fulltext-view-switch"><button class="${viewMode === 'pdf' ? 'active' : ''}" data-action="set-fulltext-view" data-view="pdf">${icon('file')} PDF</button><button class="${viewMode === 'text' ? 'active' : ''}" data-action="set-fulltext-view" data-view="text">${icon('layers')} ${mdText ? 'Markdown' : '摘要'}</button></div>`
      : '';
    const textViewer = `<div class="pdf-viewer" id="fulltext-text-panel"><article class="pdf-page"><div style="color:#777;font-size:9px">${escapeHtml(citation.source || 'Citation')} · ${mdText ? 'Markdown' : 'Abstract'}${highlightQuery ? ' · 已定位证据' : ''}</div><h2>${escapeHtml(citation.title)}</h2><p><b>${escapeHtml(citation.authors)}</b></p><h3>${mdText ? 'Full text (Markdown)' : 'Abstract'}</h3><div class="fulltext-body">${bodyHtml || '<span class="muted">无正文。请点击上方「上传全文」添加 PDF / MD。</span>'}</div><button class="ghost-button" data-action="upload-fulltext" data-id="${citation.id}">${icon('upload')} 上传全文</button></article></div>`;
    const pdfViewer = `<div class="pdf-viewer" id="fulltext-pdf-panel"><iframe class="pdf-frame" data-pdf-frame title="PDF full text"></iframe><p class="muted pdf-hint">当前为 PDF 视图。点击右侧标准会自动切到 Markdown/摘要并高亮匹配片段。</p></div>`;
    const viewer = viewMode === 'pdf' && hasPdf ? pdfViewer : textViewer;
    const hasFulltextFiles = hasPdf || Boolean(mdText.trim());
    const navHint = included.length > 1 ? `${(state.fulltextIndex || 0) + 1} / ${included.length}` : '';
    return `${header('Full text screening', '全文证据核对', 'PDF 与 Markdown 分开展示；点击右侧标准会经 Embedding（低阈值）+ LLM 定位原文并高亮。', `<button class="ghost-button" data-action="upload-fulltext" data-id="${citation.id}">${icon('upload')} 上传全文</button><button class="ghost-button danger-text" data-action="delete-fulltext" data-id="${citation.id}" ${hasFulltextFiles ? '' : 'disabled'}>${icon('x')} 删除全文</button><button class="ghost-button" data-action="prev-fulltext" ${included.length > 1 ? '' : 'disabled'}>上一条</button><button class="ghost-button" data-action="next-fulltext" ${included.length > 1 ? '' : 'disabled'}>下一条</button>`)}${state.fulltextDecision ? `<div class="status-banner">正在提交：<strong>${escapeHtml(state.fulltextDecision)}</strong>${navHint ? ` · ${navHint}` : ''}</div>` : (navHint ? `<div class="status-banner muted">待审记录 ${navHint}</div>` : '')}${viewSwitch}<div class="pdf-layout">${viewer}<aside class="eligibility-card"><div class="panel-head"><div><h3>Eligibility</h3><p>${state.criteria.length} 项标准</p></div></div>${criteriaRows}<div style="padding:14px"><div class="decision-group"><button class="decision-button include ${state.fulltextDecision === 'Include' ? 'selected' : ''}" data-action="full-include">纳入</button><button class="decision-button exclude ${state.fulltextDecision?.startsWith('Exclude') ? 'selected' : ''}" data-action="full-exclude">排除</button></div><p class="muted" style="margin-top:10px;font-size:11px;line-height:1.45">点击纳入会立即写入；排除需填写理由后提交。</p></div></aside></div>`;
  }

  function extractionFieldManager() {
    const fields = [...state.extractionFields].sort((a, b) => (a.sortOrder - b.sortOrder) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    return `<section class="panel field-manager"><div class="panel-head"><div><h3>字段管理</h3><p>按住左侧手柄拖动调整顺序；提取数据表按此顺序展示列。</p></div><button class="primary-button" data-action="add-extraction-field">${icon('plus')} 新建字段</button></div><div class="field-manager-list">${fields.map((field) => `<article class="field-manager-row" data-field-id="${field.id}"><span class="field-drag-handle" data-drag-handle draggable="false" aria-label="拖动排序" title="按住拖动排序">${icon('grip')}</span><div class="field-type-icon">${icon(field.dataType === 'number' ? 'chart' : 'table')}</div><div class="field-manager-main"><div><strong>${escapeHtml(field.label)}</strong>${field.required ? '<span class="badge red">必填</span>' : ''}</div><code>${escapeHtml(field.key)}</code><p>${escapeHtml(field.description || '暂无字段说明')}</p></div><div class="field-manager-meta"><span>${escapeHtml(extractionTypeLabels[field.dataType] || field.dataType)}</span></div><div class="field-manager-actions"><button class="icon-button" data-action="edit-extraction-field" data-id="${field.id}">${icon('edit')}</button><button class="icon-button danger" data-action="delete-extraction-field" data-id="${field.id}">${icon('x')}</button></div></article>`).join('') || '<div class="empty-state"><p>还没有提取字段</p></div>'}</div></section>`;
  }

  function extractionDataTable() {
    const fields = [...state.extractionFields].sort((a, b) => (a.sortOrder - b.sortOrder) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
    const studies = includedAfterFulltext();
    const focusCitationId = state.extractionFocus?.citationId || state.modalPayload?.citationId || '';
    const focusFieldId = state.extractionFocus?.fieldId || state.modalPayload?.fieldId || '';
    return `<section class="panel"><div class="panel-head"><div><h3>提取数据</h3><p>点击研究标题选中整行；点击单元格选中并编辑。选中样式用于 AI「预填本行 / 当前单元格」。</p></div></div>${!studies.length ? '<div class="empty-state"><p>尚无全文纳入的研究。请先完成冲突裁决与全文筛选。</p></div>' : fields.length ? `<div class="table-wrap"><table class="sheet extraction-sheet"><thead><tr><th class="study-col">Study</th>${fields.map((field) => `<th>${escapeHtml(field.label)}</th>`).join('')}</tr></thead><tbody>${studies.map((citation) => {
      const rowSelected = focusCitationId === citation.id;
      return `<tr class="${rowSelected ? 'is-selected' : ''}" data-citation-id="${citation.id}"><td class="study-col"><button type="button" class="study-select ${rowSelected ? 'is-selected' : ''}" data-action="select-extraction-row" data-citation-id="${citation.id}" title="选中本行"><strong>${escapeHtml(citation.title)}</strong>${rowSelected && !focusFieldId ? '<span class="selection-chip">已选中本行</span>' : ''}</button></td>${fields.map((field) => {
      const saved = extractionValue(citation.id, field.id);
      const evidence = (saved?.evidenceText || '').trim();
      const evidencePreview = evidence ? (evidence.length > 48 ? `${evidence.slice(0, 48)}…` : evidence) : '';
      const cellFocused = rowSelected && focusFieldId === field.id;
      return `<td class="${cellFocused ? 'is-focused-cell' : ''}"><button class="data-cell extraction-cell ${saved?.verified ? 'is-verified' : ''} ${evidence ? 'has-evidence' : ''} ${cellFocused ? 'is-focused' : ''}" data-action="edit-extraction-value" data-citation-id="${citation.id}" data-field-id="${field.id}" title="${evidence ? escapeHtml(evidence) : ''}"><span>${escapeHtml(saved?.value || '待提取')}</span>${evidence ? `<small class="extract-evidence-hint">原文 · ${escapeHtml(evidencePreview)}</small>` : (saved?.value ? '<small>无原文证据</small>' : '')}</button></td>`;
    }).join('')}</tr>`;
    }).join('')}</tbody></table></div>` : '<div class="empty-state"><p>还没有提取字段，请先在「字段管理」中创建</p></div>'}</section>`;
  }

  function extraction() {
    const eligible = includedAfterFulltext();
    const completed = state.extractionValues.filter((value) => value.value).length;
    const verified = state.extractionValues.filter((value) => value.verified).length;
    const jobBusy = state.assistantJob && !['completed', 'failed'].includes(state.assistantJob.status);
    return `${header('Structured data extraction', '结构化数据提取', '仅对全文筛选已纳入的研究提取。支持一键全部提取；打开单元格可回溯并高亮对应原文。', `<button class="primary-button" data-action="run-extract-all" ${state.credentialId && eligible.length && state.extractionFields.length && !jobBusy ? '' : 'disabled'}>${icon('spark')} 一键全部提取</button><button class="ghost-button" data-action="export-csv">${icon('download')} 导出 CSV</button>`)}
  <div class="module-switch"><button class="${state.extractionView === 'data' ? 'active' : ''}" data-extraction-view="data">${icon('table')} 提取数据</button><button class="${state.extractionView === 'fields' ? 'active' : ''}" data-extraction-view="fields">${icon('settings')} 字段管理 <span>${state.extractionFields.length}</span></button></div>
  <div class="stats-grid">${[['全文已纳入', eligible.length], ['项目字段', state.extractionFields.length], ['已填写单元格', completed], ['已人工核验', verified]].map((x) => `<div class="stat-card"><div class="stat-top">${x[0]}</div><div class="stat-value">${x[1]}</div></div>`).join('')}</div>
  ${state.extractionView === 'fields' ? extractionFieldManager() : extractionDataTable()}`;
  }

  function rob() {
    const eligible = includedAfterFulltext();
    const citation = state.robCitations.find((item) => item.id === state.robCitationId) || state.robCitations[0];
    if (!eligible.length || !citation) {
      return `${header('Risk of bias', '偏倚风险评估', '仅评估全文筛选已纳入的研究。')}<div class="empty-state"><p>尚无全文纳入的研究。请先完成冲突裁决与全文筛选。</p></div>`;
    }
    const { domain: activeDomain, question: activeQuestion } = robQuestionContext();
    if (!citation || !activeDomain || !activeQuestion) return `${header('Risk of bias', '偏倚风险评价', '划选原文绑定多段证据，可 AI 找原文或辅助判断。')}<div class="empty-state">${icon('shield')}<h3>暂无可评价研究</h3></div>`;
    const human = robJudgement(activeQuestion.key, 'human');
    const ai = robJudgement(activeQuestion.key, 'ai');
    const spans = Array.isArray(state.robEvidenceSpans) ? state.robEvidenceSpans : [];
    const sourceText = citation.fullTextMarkdown || citation.abstract || '';
    const ranked = Array.isArray(state.rankedEvidence) ? state.rankedEvidence : [];
    const highlightQuotes = [...spans, ...ranked.slice(0, 4).map((row) => row.text)].filter(Boolean);
    const bodyHtml = highlightEvidenceHtml(sourceText, highlightQuotes, {
      fullText: true,
      markAll: true,
      anchorId: 'rob-evidence-anchor',
    });
    const questionCards = state.robDomains.map((domain) => `<section class="rob-domain-card"><header><span class="criterion-id">${domain.key}</span><div><strong>${escapeHtml(domain.title)}</strong></div></header>${domain.questions.map((question) => { const h = robJudgement(question.key, 'human'); const a = robJudgement(question.key, 'ai'); return `<button class="rob-question ${question.key === activeQuestion.key ? 'active' : ''}" data-action="select-rob-question" data-question="${question.key}"><span><b>${question.key}</b>${escapeHtml(question.text)}</span><span class="rob-question-status">${h ? `<em class="badge green">人工 ${escapeHtml(h.judgement)}</em>` : '<em class="badge gray">待判断</em>'}${a ? `<em class="badge purple">AI ${escapeHtml(a.judgement)}</em>` : ''}</span></button>`; }).join('')}</section>`).join('');
    const chips = spans.length
      ? spans.map((text, index) => `<li class="rob-evidence-chip"><p>${escapeHtml(text)}</p><button type="button" class="icon-button danger" data-action="rob-remove-evidence" data-index="${index}" title="删除">${icon('x')}</button></li>`).join('')
      : '<li class="muted rob-evidence-empty">尚未绑定原文。在左侧划选文字后点「加入评估」，或使用「AI 找原文」。</li>';
    return `${header('Risk of bias', '偏倚风险评价', '划选多段原文绑定证据；AI 可单独找原文，或基于已绑定证据作答。', `<button class="primary-button" data-action="next-study">下一项研究 ${icon('arrow')}</button>`)}
  <div class="rob-study-toolbar"><label><span>当前研究</span><select class="select" data-rob-citation>${state.robCitations.map((item) => `<option value="${item.id}" ${item.id === citation.id ? 'selected' : ''}>${escapeHtml(item.title)}</option>`).join('')}</select></label></div>
  <div class="rob-review-layout"><section class="rob-source-panel"><div class="panel-head"><div><h3>原文证据</h3><p class="muted" style="font-size:11px">${ranked.length ? `Embedding 标出 ${ranked.length} 处高相关片段（高亮）；用鼠标划选后加入评估` : '划选正文加入评估；配置 Embedding 后可自动定位相关句'}</p></div></div><article class="rob-source-document"><h2>${escapeHtml(citation.title)}</h2><div id="rob-source-selectable" class="rob-source-selectable">${sourceText.trim() ? bodyHtml : '<p class="muted">无可用原文</p>'}</div></article>
  <div id="rob-selection-menu" class="rob-selection-menu" hidden><button type="button" data-action="rob-add-selection">${icon('plus')} 加入评估</button></div></section>
  <aside class="rob-assessment-panel"><div class="rob-question-list">${questionCards}</div><section class="rob-editor"><div class="rob-editor-head"><div><span class="criterion-id">${activeQuestion.key}</span><h3>${escapeHtml(activeQuestion.text)}</h3></div></div>
  <div class="rob-evidence-box ${spans.length ? 'has-evidence' : ''}"><strong>已绑定原文（${spans.length}）</strong><ul class="rob-evidence-list">${chips}</ul></div>
  <div class="form-grid rob-form"><div class="field"><label for="rob-answer">信号问题回答</label><select id="rob-answer">${['Yes', 'Probably yes', 'Probably no', 'No', 'No information'].map((value) => `<option ${value === (human?.answer || 'No information') ? 'selected' : ''}>${value}</option>`).join('')}</select></div><div class="field"><label for="rob-judgement">领域判断</label><select id="rob-judgement">${['Low risk', 'Some concerns', 'High risk'].map((value) => `<option ${value === (human?.judgement || 'Some concerns') ? 'selected' : ''}>${value}</option>`).join('')}</select></div><div class="field full"><label for="rob-rationale">判断理由</label><textarea id="rob-rationale">${escapeHtml(human?.rationale || '')}</textarea></div></div>
  <div class="rob-editor-actions"><button class="ghost-button" data-action="run-rob-find" ${state.robBusy ? 'disabled' : ''}>${icon('spark')} AI 找原文</button><button class="ghost-button" data-action="run-rob-ai" ${state.robBusy ? 'disabled' : ''}>${icon('spark')} AI 评估</button><button class="primary-button" data-action="save-rob" ${spans.length ? '' : 'disabled'}>${icon('check')} 保存人工判断</button></div></section></aside></div>`;
  }

  function adjudication() {
    recomputeDerivedCounts();
    const conflicts = screeningConflicts();
    const current = conflicts[state.adjudicationIndex || 0];
    if (!current) {
      return `${header('Adjudication center', '冲突裁决中心', '展示双人 Diff（human vs human_b）或人机判断不一致的记录。')}<div class="empty-state">${icon('users')}<h3>当前没有初筛冲突</h3><p class="muted">可在初筛页导出/导入 Diff，或完成人机筛后回来查看。</p><button class="primary-button" data-nav="screening">去初筛</button></div>`;
    }
    const { citation, kind, left, right } = current;
    const isDual = kind === 'human_human_b';
    const leftLabel = isDual ? '本平台 Reviewer' : 'Human';
    const rightLabel = isDual ? '导入 Reviewer B' : 'Qiuzheng AI';
    const rightAvatar = isDual ? 'B' : 'AI';
    const rightTone = isDual ? 'blue' : 'purple';
    const badge = isDual ? '双人 Diff' : '人机冲突';
    return `${header('Adjudication center', '冲突裁决中心', '并排查看双方判断；终裁写入审计，并解除纳入阻塞。', `<button class="ghost-button" data-action="skip">下一条</button><button class="primary-button" data-action="next-conflict">下一个冲突</button>`)}<section class="panel"><div class="panel-head"><div><h3>Conflict · Title/abstract · ${badge}</h3><p>${escapeHtml(citation.title)}</p></div><span class="badge red">${conflicts.length} 待处理</span></div><div class="panel-body"><div class="compare-grid">
    ${reviewer((state.user?.name || 'A').slice(0, 2), leftLabel, left.decision, left.rationale || '', left.evidence || '', 'green')}
    ${reviewer(rightAvatar, rightLabel, right.decision, right.rationale || '', right.evidence || '', rightTone)}
  </div><div class="resolve-box"><div><strong>最终裁决</strong></div><div class="decision-group"><button class="decision-button include ${state.adjudicationResolution === 'Include' ? 'selected' : ''}" data-resolution="Include" ${state.adjudicationResolution ? 'disabled' : ''}>纳入</button><button class="decision-button exclude ${state.adjudicationResolution === 'Exclude' ? 'selected' : ''}" data-resolution="Exclude" ${state.adjudicationResolution ? 'disabled' : ''}>排除</button><button class="decision-button uncertain ${state.adjudicationResolution === 'Uncertain' ? 'selected' : ''}" data-resolution="Uncertain" ${state.adjudicationResolution ? 'disabled' : ''}>待定</button></div></div></div></section>`;
  }

  function synthesis() {
    recomputeDerivedCounts();
    const keys = [
      ['protocol', '方案'],
      ['screening', '初筛'],
      ['adjudication', '裁决'],
      ['fulltext', '全文'],
      ['extraction', '提取'],
      ['rob', '偏倚'],
      ['meta', 'Meta'],
      ['audit', '审计'],
    ];
    const selected = state.synthesisQueries || [];
    const knowledge = state.synthesisKnowledge;
    const sections = knowledge?.sections || {};
    const metaSection = sections.meta;
    const latestCompose = (state.synthesisComposes || [])[0];
    const chips = keys.map(([id, label]) => {
      const on = selected.includes(id);
      return `<button type="button" class="query-chip ${on ? 'active' : ''}" data-action="toggle-synthesis-query" data-query="${id}">${escapeHtml(label)}</button>`;
    }).join('');
    const preview = knowledge
      ? `<div class="knowledge-grid">
        ${sections.screening ? `<article class="knowledge-card"><strong>初筛</strong><p>${sections.screening.humanDecisions}/${sections.screening.citationCount} 已判 · 剩余 ${sections.screening.remaining}</p></article>` : ''}
        ${sections.fulltext ? `<article class="knowledge-card"><strong>全文</strong><p>纳入 ${sections.fulltext.included} · 排除 ${sections.fulltext.excluded}</p></article>` : ''}
        ${sections.extraction ? `<article class="knowledge-card"><strong>提取</strong><p>已填 ${sections.extraction.filledCells} · 核验 ${sections.extraction.verifiedCells}</p></article>` : ''}
        ${sections.rob ? `<article class="knowledge-card"><strong>RoB</strong><p>人工判断 ${sections.rob.humanJudgementCount}</p></article>` : ''}
        ${metaSection ? `<article class="knowledge-card"><strong>Meta 知识库</strong><p>${(metaSection.analyses || []).map((a) => {
          const s = a.latestRun?.summary;
          return s
            ? `${escapeHtml(a.name)}: ${Number(s.yiDisplay).toFixed(2)} [${Number(s.ciLowDisplay).toFixed(2)}, ${Number(s.ciHighDisplay).toFixed(2)}]`
            : `${escapeHtml(a.name)}: 尚无结果`;
        }).join('<br>') || '暂无分析'}</p></article>` : ''}
      </div>`
      : '<p class="muted">选择上方知识源后点击「召回知识」。Meta 结果在此作为可召回片段，不在本页重算。</p>';
    return `${header('Evidence synthesis', '证据综合与报告', '通过 query 召回各阶段知识（含 Meta 结果）再综合成报告；Meta 计算请在独立「Meta 分析」模块完成。', `<button class="ghost-button" data-action="synthesis-recall" ${state.synthesisBusy ? 'disabled' : ''}>${icon('search')} 召回知识</button><button class="primary-button" data-action="synthesis-compose" ${state.synthesisBusy ? 'disabled' : ''}>${icon('spark')} 生成综合稿</button>`)}
  <section class="panel"><div class="panel-head"><div><h3>知识源 Query</h3><p>勾选要召回的阶段；Meta 提供汇总效应知识，不替代统计计算。</p></div>
    <label class="check-field"><input type="checkbox" data-action="toggle-synthesis-llm" ${state.synthesisUseLlm ? 'checked' : ''}/> 生成时附加 LLM 叙述</label>
  </div><div class="panel-body"><div class="query-chip-row">${chips}</div>${preview}</div></section>
  ${latestCompose ? `<section class="panel"><div class="panel-head"><div><h3>${escapeHtml(latestCompose.title || '综合稿')}</h3><p>${new Date(latestCompose.createdAt).toLocaleString('zh-CN')} · queries: ${(latestCompose.queries || []).join(', ')}</p></div><button class="ghost-button" data-action="download-synthesis-compose">${icon('download')} 下载 Markdown</button></div><div class="panel-body"><pre class="synthesis-markdown">${escapeHtml(latestCompose.markdown || '')}</pre></div></section>` : ''}`;
  }

  function meta() {
    const analyses = state.metaAnalyses || [];
    const detail = state.metaDetail;
    const activeId = state.metaAnalysisId || analyses[0]?.id || '';
    const latestRun = detail?.runs?.[0];
    const result = latestRun?.resultJson || {};
    const summary = result.summary;
    const rows = detail?.rows || [];
    const busy = state.metaBusy;
    const disabled = !activeId || busy ? 'disabled' : '';
    const recipeBtn = (recipe, label) =>
      `<button type="button" class="ghost-button meta-recipe-btn" data-action="run-meta-recipe" data-recipe="${recipe}" ${disabled}>${escapeHtml(label)}</button>`;
    const list = analyses.map((a) => `<div class="meta-analysis-item ${a.id === activeId ? 'active' : ''}"><button type="button" class="meta-analysis-select" data-action="select-meta-analysis" data-id="${a.id}"><strong>${escapeHtml(a.name)}</strong><small>${escapeHtml(a.measure)} · ${a._count?.rows || 0} 行</small></button><button type="button" class="icon-button danger" data-action="delete-meta-analysis" data-id="${a.id}" title="删除分析" aria-label="删除分析">${icon('x')}</button></div>`).join('')
      || '<p class="muted">还没有结局分析。点击「新建分析」开始。</p>';
    const table = rows.length
      ? `<div class="table-wrap"><table class="sheet"><thead><tr><th>Study</th><th>试验组</th><th>对照组</th><th>亚组</th><th>试验组事件</th><th>试验组 n</th><th>对照组事件</th><th>对照组 n</th><th>N</th><th>来源</th></tr></thead><tbody>${rows.map((r) => {
        const nT = r.nT != null ? Number(r.nT) : null;
        const nC = r.nC != null ? Number(r.nC) : null;
        const nTotal = nT != null && nC != null ? nT + nC : (nT ?? nC);
        return `<tr><td class="study-col"><strong>${escapeHtml(r.label || r.citation?.title || r.citationId)}</strong></td><td>${escapeHtml(r.armT || 'Treatment')}</td><td>${escapeHtml(r.armC || 'Control')}</td><td>${escapeHtml(r.subgroup || '—')}</td><td>${r.eventsT ?? '—'}</td><td>${nT ?? '—'}</td><td>${r.eventsC ?? '—'}</td><td>${nC ?? '—'}</td><td><strong>${nTotal ?? '—'}</strong></td><td><small>${escapeHtml(r.source || '')}</small></td></tr>`;
      }).join('')}</tbody></table></div><p class="muted" style="margin-top:8px;font-size:11px">网状 Meta 需要至少 3 个不同干预臂（armT/armC）；亚组分析需填写 subgroup。</p>`
      : '<div class="empty-state"><p>暂无效应行。可从提取字段映射（events_t / n_t / events_c / n_c，可选 subgroup / arm_t / arm_c），或用「演示行」。</p></div>';

    const plot = latestRun?.forestSvg
      ? `<div class="forest-wrap">${latestRun.forestSvg}</div>`
      : '<p class="muted">运行下方统计动作后显示图形结果。</p>';

    const fmt = (v, d = 3) => (v == null || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(d));
    const stats = summary
      ? `<div class="stats-grid meta-stats">${[
        ['Recipe', escapeHtml(latestRun?.recipe || '—')],
        ['Pooled', summary.yiDisplay == null ? '—' : fmt(summary.yiDisplay)],
        ['95% CI', summary.ciLowDisplay == null ? '—' : `${fmt(summary.ciLowDisplay)} – ${fmt(summary.ciHighDisplay)}`],
        ['I²', `${fmt(summary.i2, 1)}%`],
        ['Q / p', `${fmt(summary.q, 2)}${summary.pQ != null ? ` / ${fmt(summary.pQ, 3)}` : ''}`],
        ['τ²', fmt(summary.tau2, 4)],
        ['总样本量 N', summary.totalN != null ? String(summary.totalN) : '—'],
        ['研究数 k', String(summary.k ?? '—')],
      ].map(([k, v]) => `<div class="stat-card"><div class="stat-top">${k}</div><div class="stat-value" style="font-size:18px">${v}</div></div>`).join('')}</div>`
      : '';

    let extra = '';
    if (result.egger) {
      extra += `<div class="meta-result-block"><h4>Egger 检验</h4><p>intercept=${fmt(result.egger.intercept, 4)} (SE ${fmt(result.egger.seIntercept, 4)}) · t=${fmt(result.egger.t, 3)} · p=${result.egger.pValue == null ? '—' : fmt(result.egger.pValue, 4)}</p><p class="muted">${escapeHtml(result.egger.interpretation || '')}</p></div>`;
    }
    if (result.predictionInterval) {
      const pi = result.predictionInterval;
      extra += `<div class="meta-result-block"><h4>预测区间（随机效应）</h4><p>${fmt(pi.piLowDisplay)} – ${fmt(pi.piHighDisplay)} <span class="muted">(df=${pi.df})</span></p></div>`;
    }
    if (result.trimFill) {
      extra += `<div class="meta-result-block"><h4>Trim-and-fill</h4><p>估计填补 ${result.trimFill.filledCount} 项 · 调整后 pooled=${fmt(result.trimFill.adjusted?.yiDisplay)}（观察 ${fmt(result.trimFill.observed?.yiDisplay)}）</p></div>`;
    }
    if (Array.isArray(result.leaveOneOut) && result.leaveOneOut.length) {
      extra += `<div class="meta-result-block"><h4>逐一剔除</h4><div class="table-wrap"><table class="sheet"><thead><tr><th>剔除研究</th><th>k</th><th>Pooled</th><th>95% CI</th><th>I²</th></tr></thead><tbody>${result.leaveOneOut.map((row) => `<tr><td>${escapeHtml(row.omittedLabel)}</td><td>${row.pooled?.k ?? '—'}</td><td>${fmt(row.pooled?.yiDisplay)}</td><td>${fmt(row.pooled?.ciLowDisplay)} – ${fmt(row.pooled?.ciHighDisplay)}</td><td>${fmt(row.pooled?.i2, 1)}%</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    if (Array.isArray(result.subgroups) && result.subgroups.length) {
      extra += `<div class="meta-result-block"><h4>亚组分析</h4><div class="table-wrap"><table class="sheet"><thead><tr><th>亚组</th><th>k</th><th>Pooled</th><th>95% CI</th><th>I²</th></tr></thead><tbody>${result.subgroups.map((g) => `<tr><td>${escapeHtml(g.name)}</td><td>${g.k}</td><td>${fmt(g.pooled?.yiDisplay)}</td><td>${fmt(g.pooled?.ciLowDisplay)} – ${fmt(g.pooled?.ciHighDisplay)}</td><td>${fmt(g.pooled?.i2, 1)}%</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    if (Array.isArray(result.cumulative) && result.cumulative.length) {
      extra += `<div class="meta-result-block"><h4>累积 Meta</h4><div class="table-wrap"><table class="sheet"><thead><tr><th>加入</th><th>k</th><th>Pooled</th><th>95% CI</th><th>I²</th></tr></thead><tbody>${result.cumulative.map((c) => `<tr><td>${escapeHtml(c.addedLabel)}</td><td>${c.k}</td><td>${fmt(c.pooled?.yiDisplay)}</td><td>${fmt(c.pooled?.ciLowDisplay)} – ${fmt(c.pooled?.ciHighDisplay)}</td><td>${fmt(c.pooled?.i2, 1)}%</td></tr>`).join('')}</tbody></table></div></div>`;
    }
    if (result.network) {
      const nma = result.network;
      const league = Array.isArray(nma.league) ? nma.league.slice(0, 24) : [];
      extra += `<div class="meta-result-block"><h4>网状 Meta（netmeta）</h4><p>臂数 ${nma.nArms ?? '—'} · 对照 ${escapeHtml(nma.reference || '')} · Q=${fmt(nma.consistency?.Q, 2)} p=${nma.consistency?.pvalue == null ? '—' : fmt(nma.consistency.pvalue, 3)}</p>${league.length ? `<div class="table-wrap"><table class="sheet"><thead><tr><th>对比</th><th>TE</th><th>95% CI</th></tr></thead><tbody>${league.map((L) => `<tr><td>${escapeHtml(L.treat1)} vs ${escapeHtml(L.treat2)}</td><td>${fmt(L.te)}</td><td>${fmt(L.lower)} – ${fmt(L.upper)}</td></tr>`).join('')}</tbody></table></div>` : '<p class="muted">无 league 表输出</p>'}</div>`;
    }

    const actions = `<div class="meta-actions">
      <div class="meta-action-group"><span class="meta-action-label">管理</span><button class="ghost-button" data-action="create-meta-analysis">${icon('plus')} 新建</button><button class="ghost-button danger-text" data-action="delete-meta-analysis" data-id="${activeId}" ${disabled}>${icon('x')} 删除</button><button class="ghost-button" data-action="meta-seed-demo-rows" ${disabled}>演示行</button><button class="ghost-button" data-action="meta-map-extraction" ${disabled}>${icon('table')} 从提取映射</button><button class="ghost-button" data-action="assistant-meta-validate" ${disabled}>可计算性</button></div>
      <div class="meta-action-group"><span class="meta-action-label">成对合并</span>${recipeBtn('fixed_random', '固定/随机效应')}${recipeBtn('prediction_interval', '预测区间')}</div>
      <div class="meta-action-group"><span class="meta-action-label">偏倚诊断</span>${recipeBtn('funnel', '漏斗图')}${recipeBtn('egger', 'Egger')}${recipeBtn('trim_fill', 'Trim-and-fill')}</div>
      <div class="meta-action-group"><span class="meta-action-label">探索性</span>${recipeBtn('leave_one_out', '逐一剔除')}${recipeBtn('subgroup', '亚组分析')}${recipeBtn('cumulative', '累积 Meta')}</div>
      <div class="meta-action-group"><span class="meta-action-label">网状</span>${recipeBtn('network', '网状 Meta (R)')}</div>
    </div>`;

    const computability = state.metaComputability;
    const computabilityBanner = computability
      ? `<div class="meta-computability ${computability.canRun ? 'ok' : 'bad'}"><strong>可计算性</strong>：${computability.computable}/${computability.total} 行可算${computability.notComputable ? ` · ${computability.notComputable} 行需转换或补全` : ''}${computability.canRun ? '' : ' · 运行已拦截'}。右侧助手可调用 rate_to_events / or_ci_to_yi_sei 等工具。</div>`
      : '';
    return `${header('Meta-analysis', 'Meta 分析', '白名单统计配方：成对分析用 TypeScript 确定性计算；网状 Meta 调用本机 R/netmeta。', actions)}
  ${computabilityBanner}
  <div class="meta-layout"><aside class="panel meta-side"><div class="panel-head"><h3>结局分析</h3></div><div class="panel-body meta-analysis-list">${list}</div></aside>
  <div class="meta-main">${activeId ? `<section class="panel"><div class="panel-head"><div><h3>${escapeHtml(detail?.name || '效应表')}</h3><p>${escapeHtml(detail?.measure || '')} · 偏好模型 ${escapeHtml(detail?.modelPref || '')}</p></div></div><div class="panel-body">${table}</div></section>
  <section class="panel"><div class="panel-head"><div><h3>最新运行</h3><p>${latestRun ? `${escapeHtml(latestRun.recipe || '')} · ${new Date(latestRun.createdAt).toLocaleString('zh-CN')}` : '尚未运行'}${latestRun?.status === 'failed' ? ' · 失败' : ''}</p></div></div><div class="panel-body">${latestRun?.errorMessage ? `<div class="meta-computability bad">${escapeHtml(latestRun.errorMessage)}</div>` : ''}${stats}${extra}${plot}</div></section>` : '<div class="empty-state"><h3>选择或新建一个分析</h3></div>'}</div></div>`;
  }

  function audit() {
    const actors = [...new Set(state.audits.map((event) => event.actor))];
    const modulesInLog = [...new Set(state.audits.map((event) => event.module).filter(Boolean))];
    const events = state.audits.filter((event) => matchesQuery([event.actor, event.action, event.detail, event.version], state.auditQuery))
      .filter((event) => state.auditActor === '全部操作者' || event.actor === state.auditActor)
      .filter((event) => state.auditModule === '全部模块' || event.module === state.auditModule);
    return `${header('Audit trail', '完整审计记录', '追踪人工、AI 与规则系统的每一次操作。', `<button class="primary-button" data-action="export-audit">${icon('download')} 导出日志</button>`)}<section class="panel"><div class="panel-body"><div class="toolbar"><label class="filter-input">${icon('search')}<input data-filter="audit-query" value="${escapeHtml(state.auditQuery)}" placeholder="搜索操作、用户或版本" /></label><select class="select" data-filter="audit-actor">${['全部操作者', ...actors].map((value) => `<option ${state.auditActor === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select><select class="select" data-filter="audit-module">${['全部模块', ...modulesInLog].map((value) => `<option ${state.auditModule === value ? 'selected' : ''}>${escapeHtml(value)}</option>`).join('')}</select><span class="muted">${events.length} 条记录</span></div><div class="audit-timeline">${events.length ? events.map((e) => `<article class="audit-event"><header><strong>${escapeHtml(e.actor)} · ${escapeHtml(e.action)}</strong><time>${escapeHtml(e.time)}</time></header><p>${escapeHtml(e.detail)}</p><code>${escapeHtml(e.version)}</code></article>`).join('') : '<div class="empty-state"><p>没有符合当前条件的审计记录</p></div>'}</div></div></section>`;
  }

  return { dashboard, protocol, searchPage, library, screening, fulltext, extraction, rob, meta, adjudication, synthesis, audit, reviewer };
}
