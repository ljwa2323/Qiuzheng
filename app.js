const icon = (name, size = 18) => {
  const paths = {
    home: '<path d="M3 11 12 4l9 7"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
    question: '<circle cx="12" cy="12" r="9"/><path d="M9.8 9a2.4 2.4 0 1 1 3.7 2c-1 .6-1.5 1.1-1.5 2"/><path d="M12 17h.01"/>',
    search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
    library: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
    layers: '<path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5"/><path d="m3 17 9 5 9-5"/>',
    file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6"/>',
    table: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 10h18M9 4v16"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10"/><path d="m9 12 2 2 4-4"/>',
    users: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
    chart: '<path d="M3 3v18h18"/><path d="m7 16 4-5 4 3 5-8"/>',
    report: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><path d="M8 7h8M8 11h8M8 15h5"/>',
    history: '<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/>',
    settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21H10v-.1A1.7 1.7 0 0 0 9 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-1.5-1H3v-4h.1A1.7 1.7 0 0 0 4.6 9a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.5V3h4v.1A1.7 1.7 0 0 0 15 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9a1.7 1.7 0 0 0 1.5 1h.1v4h-.1a1.7 1.7 0 0 0-1.5 1Z"/>',
    bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M10 21h4"/>',
    spark: '<path d="m12 3-1.1 3.3a4 4 0 0 1-2.6 2.6L5 10l3.3 1.1a4 4 0 0 1 2.6 2.6L12 17l1.1-3.3a4 4 0 0 1 2.6-2.6L19 10l-3.3-1.1a4 4 0 0 1-2.6-2.6L12 3Z"/><path d="m5 3 .5 1.5L7 5l-1.5.5L5 7l-.5-1.5L3 5l1.5-.5L5 3Z"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    x: '<path d="m18 6-12 12M6 6l12 12"/>',
    alert: '<path d="M10.3 2.9 1.8 17a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 2.9a2 2 0 0 0-3.4 0Z"/><path d="M12 9v4M12 17h.01"/>',
    arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m17 8-5-5-5 5M12 3v12"/>',
    download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5M12 15V3"/>',
    filter: '<path d="M4 5h16M7 12h10M10 19h4"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    command: '<path d="M18 9a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12Z"/>',
    send: '<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
    more: '<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
    menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.5.5l2-2a5 5 0 0 0-7-7l-1.1 1"/><path d="M14 11a5 5 0 0 0-7.5-.5l-2 2a5 5 0 0 0 7 7l1.1-1"/>',
    copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
    brain: '<path d="M9.5 4A2.5 2.5 0 0 0 7 6.5v.4a3 3 0 0 0-2 4.8A3.2 3.2 0 0 0 7 17.5 2.5 2.5 0 0 0 12 17V7a3 3 0 0 0-2.5-3Z"/><path d="M14.5 4A2.5 2.5 0 0 1 17 6.5v.4a3 3 0 0 1 2 4.8 3.2 3.2 0 0 1-2 5.8 2.5 2.5 0 0 1-5-.5V7a3 3 0 0 1 2.5-3Z"/>',
  };
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.file}</svg>`;
};

const modules = [
  { id: 'dashboard', label: '项目总览', icon: 'home' },
  { id: 'protocol', label: '研究问题与方案', icon: 'question' },
  { id: 'search', label: '检索策略', icon: 'search', count: 2 },
  { id: 'library', label: '文献管理', icon: 'library' },
  { id: 'screening', label: '题目摘要初筛', icon: 'layers', count: 128 },
  { id: 'fulltext', label: '全文筛选', icon: 'file', count: 37 },
  { id: 'extraction', label: '数据提取', icon: 'table', count: 18 },
  { id: 'rob', label: '偏倚风险', icon: 'shield', count: 24 },
  { id: 'adjudication', label: '冲突裁决', icon: 'users', count: 34 },
  { id: 'synthesis', label: '证据综合与报告', icon: 'chart' },
  { id: 'audit', label: '审计记录', icon: 'history' },
];

const state = {
  active: 'dashboard',
  aiTab: 'decision',
  aiOpen: false,
  sidebarOpen: false,
  screenMode: 'single',
  screeningIndex: 0,
  decision: null,
  db: 'PubMed',
  modal: null,
};

const screeningCases = [
  {
    title: 'Large language models for automated title and abstract screening in systematic reviews: a multicenter evaluation',
    authors: 'Martinez R, Chen Y, Patel S, et al.',
    journal: 'J Clin Epidemiol. 2026;178:45–57',
    abstract: 'Background: Screening citations is a major source of workload in evidence synthesis. We conducted a multicenter retrospective evaluation of large language models for title and abstract screening. Methods: Twelve systematic reviews from four clinical domains were included. Two independent reviewers established the reference standard. The model classified each record as include, exclude, or uncertain and provided criterion-linked evidence. Results: Across 31,428 citations, sensitivity was 0.982 and specificity was 0.714. Human review was required for 18.6% of records. Conclusion: A selective human review workflow may reduce workload while preserving recall.',
    ai: 'Include', confidence: 'High', reason: '研究直接评估 LLM 辅助系统综述题目摘要筛选，研究设计和结局均符合方案。', criterion: 'P1 · I1 · S1', evidence: 'We conducted a multicenter retrospective evaluation of large language models for title and abstract screening.'
  },
  {
    title: 'Machine learning approaches to predict hospital readmission in patients with heart failure',
    authors: 'Kim J, Oliveira L, Wang T',
    journal: 'BMC Med Inform Decis Mak. 2025;25:214',
    abstract: 'This study developed machine learning models to predict 30-day readmission among adults hospitalized with heart failure. Electronic health record variables were used to train gradient boosting and neural network models. The best model achieved an area under the receiver operating characteristic curve of 0.81. The study did not address literature review, evidence synthesis, or citation screening.',
    ai: 'Exclude', confidence: 'High', reason: '研究对象是住院患者再入院预测，不涉及系统综述或文献筛选。', criterion: 'P1', evidence: 'This study developed machine learning models to predict 30-day readmission among adults hospitalized with heart failure.'
  },
  {
    title: 'Artificial intelligence in evidence synthesis: a scoping review of emerging applications',
    authors: 'Ahmed N, Rossi F, Li K',
    journal: 'Res Synth Methods. 2026;17:102–119',
    abstract: 'We mapped artificial intelligence applications across evidence synthesis. Studies addressing search, screening, extraction, risk of bias, and drafting were described. Because of heterogeneity, performance estimates were not pooled. The review discusses human oversight but does not report an original evaluation of a screening system.',
    ai: 'Uncertain', confidence: 'Moderate', reason: '主题相关，但可能属于二次研究。是否纳入取决于 S2 对综述类研究的定义。', criterion: 'S2', evidence: 'We mapped artificial intelligence applications across evidence synthesis.'
  }
];

const titleMap = Object.fromEntries(modules.map(m => [m.id, m.label]));

function sidebar() {
  return `<aside class="sidebar ${state.sidebarOpen ? 'open' : ''}">
    <div class="brand"><div class="brand-mark">证</div><div><div class="brand-name">求证</div><div class="brand-sub">Evidence Workspace</div></div></div>
    <div class="project-switcher" data-action="project"><small>当前项目</small><strong><span>LLM 辅助系统综述</span><span>⌄</span></strong></div>
    <div class="nav-section-label">工作流程</div>
    <nav class="nav-list">${modules.slice(0,10).map(navItem).join('')}</nav>
    <div class="nav-section-label">项目管理</div>
    <nav class="nav-list">${modules.slice(10).map(navItem).join('')}<button class="nav-item" data-action="settings"><span class="nav-icon">${icon('settings')}</span><span>项目设置</span></button></nav>
    <div class="sidebar-footer"><div class="team-card"><div class="avatar">JL</div><div><strong>Jiawei Luo</strong><small>项目负责人</small></div></div></div>
  </aside>`;
}

function navItem(m) {
  return `<button class="nav-item ${state.active === m.id ? 'active' : ''}" data-nav="${m.id}"><span class="nav-icon">${icon(m.icon)}</span><span>${m.label}</span>${m.count ? `<span class="count">${m.count}</span>` : ''}</button>`;
}

function topbar() {
  return `<header class="topbar">
    <button class="icon-button mobile-menu" data-action="menu">${icon('menu')}</button>
    <div class="crumb"><small>LLM 辅助系统综述 / 当前阶段</small><h1>${titleMap[state.active]}</h1></div>
    <div class="topbar-actions">
      <button class="search-trigger" data-action="global-search">${icon('search')}<span>搜索项目内容</span><kbd>⌘ K</kbd></button>
      <button class="icon-button" data-action="notification">${icon('bell')}</button>
      <button class="ghost-button" data-action="team">${icon('users')} 团队</button>
      <button class="primary-button" data-action="ai-toggle">${icon('spark')} AI 协作</button>
    </div>
  </header>`;
}

function app() {
  document.getElementById('app').innerHTML = `<div class="app-shell">${sidebar()}<main class="workspace">${topbar()}${renderPage()}</main>${aiPanel()}</div>${modal()}`;
  bindEvents();
}

function header(eyebrow, title, subtitle, actions = '') {
  return `<div class="page-header"><div><div class="eyebrow">${eyebrow}</div><h2>${title}</h2><p>${subtitle}</p></div>${actions ? `<div class="page-actions">${actions}</div>` : ''}</div>`;
}

function renderPage() {
  const pages = { dashboard, protocol, searchPage, library, screening, fulltext, extraction, rob, adjudication, synthesis, audit };
  return `<section class="page">${(pages[state.active] || dashboard)()}</section>`;
}

function dashboard() {
  const stats = [
    ['待你处理', '128', '较昨日减少 36', 'alert', 'amber'],
    ['去重后文献', '12,310', '来自 4 个数据库', 'library', 'blue'],
    ['AI 已完成', '9,846', '本周 +2,417', 'spark', 'green'],
    ['人机冲突', '34', '需独立裁决', 'users', 'red'],
  ];
  return `${header('Review control center','上午好，今天从 128 项待办开始','平台会优先呈现需要人工判断、可能影响召回率和存在决策冲突的任务。', `<button class="ghost-button" data-action="export">${icon('download')} 导出状态</button><button class="primary-button" data-nav="screening">继续筛选 ${icon('arrow')}</button>`)}
    <div class="stats-grid">${stats.map(([label,value,meta,ic,c]) => `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon ${c === 'green' ? 'badge green' : `badge ${c}`}">${icon(ic)}</span></div><div class="stat-value">${value}</div><div class="stat-meta"><span class="trend">●</span>${meta}</div></article>`).join('')}</div>
    <div class="grid-2">
      <section class="panel"><div class="panel-head"><div><h3>综述进度</h3><p>从研究问题到最终报告的完整流程</p></div><button class="link-button" data-action="workflow-detail">查看计划</button></div><div class="panel-body"><div class="workflow">
        ${[['方案','已锁定','done','protocol'],['检索','待验证','done','search'],['筛选','79.8%','active','screening'],['提取','42.3%','','extraction'],['综合','未开始','','synthesis']].map((x,i)=>`<div class="workflow-step ${x[2]}" data-nav="${x[3]}"><div class="step-dot">${x[2]==='done'?icon('check',13):i+1}</div><strong>${x[0]}</strong><small>${x[1]}</small></div>`).join('')}
      </div></div></section>
      <section class="panel"><div class="panel-head"><div><h3>本周处理量</h3><p>人工处理与 AI 自动处理</p></div><span class="badge green">+18.4%</span></div><div class="panel-body"><div class="mini-chart">${[45,62,53,81,76,94,68].map((h,i)=>`<div class="bar-wrap"><div class="bar" style="height:${h}%"></div><span>${['一','二','三','四','五','六','日'][i]}</span></div>`).join('')}</div></div></section>
    </div>
    <div class="grid-2">
      <section class="panel"><div class="panel-head"><div><h3>需要你处理</h3><p>已按风险和影响程度排序</p></div><button class="link-button" data-nav="adjudication">查看全部</button></div><div class="panel-body task-list">
        ${taskRow('alert','amber','高不确定性初筛','干预措施定义不清或摘要信息不足',86,'screening')}
        ${taskRow('users','red','人机判断冲突','人工判断与 AI 独立判断不一致',34,'adjudication')}
        ${taskRow('file','blue','全文尚未获取','尝试 DOI、PMID 与机构链接',37,'fulltext')}
        ${taskRow('table','green','提取字段异常','跨正文、表格和附录数值不一致',18,'extraction')}
      </div></section>
      <section class="panel"><div class="panel-head"><div><h3>最近活动</h3><p>项目成员与 AI 操作记录</p></div><button class="link-button" data-nav="audit">完整日志</button></div><div class="panel-body activity-list">
        ${activity('AI','AI 筛选器完成了 642 条记录','其中 53 条升级至人工处理','8 分钟前')}
        ${activity('WQ','王巧修改了纳入标准 P2','影响 216 条既往决策','43 分钟前')}
        ${activity('JL','你裁决了 12 条人机冲突','10 条保留人工原判断','2 小时前')}
        ${activity('AI','检索质控发现 1 篇哨兵文献遗漏','建议补充术语 semi-automation','昨天')}
      </div></section>
    </div>`;
}

function taskRow(ic,color,title,desc,count,nav) { return `<div class="task-row" data-nav="${nav}"><div class="task-symbol badge ${color}">${icon(ic)}</div><div class="task-copy"><strong>${title}</strong><span>${desc}</span></div><div class="task-count">${count}</div>${icon('chevron')}</div>`; }
function activity(initial,text,detail,time) { return `<div class="activity"><div class="activity-avatar">${initial}</div><div><p>${text}</p><small>${detail}</small></div><time>${time}</time></div>`; }

function protocol() {
  const cards = [
    ['P','研究对象','Population',['年龄 ≥18 岁的系统综述研究人员或证据综合团队','研究任务包含至少 500 条待筛选记录'],['非医学或健康相关证据综合','纯教育场景，无真实研究任务']],
    ['I','干预','Intervention',['使用大语言模型辅助至少一个系统综述环节','报告清晰的人机协作流程'],['仅使用传统机器学习分类器','无人工参与的全自动流程']],
    ['C','对照','Comparator',['双人独立筛选或单人筛选加复核','可包含 LLM 单独表现作为补充对照'],['缺乏任何可解释参照组']],
    ['O','结局','Outcomes',['敏感度或漏筛率','人工时间、工作量或决策质量','人机分歧与纠错指标'],['仅报告用户满意度']],
    ['S','研究设计','Study design',['前瞻或回顾性验证研究','随机或交叉人机协作实验'],['观点、社论与无原始数据的综述']],
  ];
  return `${header('Protocol v1.4','研究问题与纳入排除标准','所有下游判断都会引用标准 ID。修改标准后，平台会识别可能受影响的既往决策。', `<button class="ghost-button" data-action="history">${icon('history')} 版本历史</button><button class="primary-button" data-action="add-criterion">${icon('plus')} 添加标准</button>`)}
    <div class="version-banner">${icon('alert')}<div><strong>P2 在昨天发生修改</strong><br>系统识别到 216 条可能受影响的既往决策，其中 28 条风险较高。</div><button class="ghost-button" data-action="recheck">重新评估</button></div>
    <div class="grid-2" style="margin-top:16px"><section class="panel"><div class="panel-head"><div><h3>研究问题</h3><p>Human and LLM collaboration across the systematic review lifecycle</p></div><button class="icon-button" data-action="edit-question">${icon('edit')}</button></div><div class="panel-body"><div class="eyebrow">Primary question</div><div style="font: 20px/1.55 Georgia,serif">在人机共同完成系统综述时，基于任务风险、不确定性与证据充分性的动态协作流程，能否在维持筛选质量的同时降低人工工作量？</div><div class="chips" style="margin-top:15px"><span class="chip controlled">Intervention review</span><span class="chip">Human AI collaboration</span><span class="chip">Evidence synthesis</span></div></div></section>
    <section class="panel"><div class="panel-head"><div><h3>方案完整性</h3><p>可进入检索策略验证</p></div><span class="badge green">92%</span></div><div class="panel-body"><div class="validation-score"><div class="score-ring"><strong>92</strong></div><div><p><strong>9 项已完成，1 项待确认</strong></p><small>仍需定义自动排除的最大可接受漏筛率。</small></div></div><div class="progress-track" style="margin-top:18px"><span style="width:92%"></span></div></div></section></div>
    <div class="section-stack">${cards.map(c=>criterionCard(...c)).join('')}</div>`;
}

function criterionCard(id,title,en,include,exclude) { return `<article class="editor-card"><div class="editor-title"><div class="criterion-id">${id}</div><div><strong>${title}</strong><small>${en}</small></div><button class="icon-button edit" data-action="edit-criterion" data-id="${id}">${icon('edit')}</button></div><div class="criteria-columns"><div class="criteria-col"><h4>纳入标准</h4>${include.map((x,i)=>`<div class="criterion-line">${icon('check')}<span><b>${id}${i+1}</b> · ${x}</span></div>`).join('')}</div><div class="criteria-col"><h4>排除标准</h4>${exclude.map((x,i)=>`<div class="criterion-line exclude">${icon('x')}<span><b>${id}${i+include.length+1}</b> · ${x}</span></div>`).join('')}</div></div></article>`; }

function searchPage() {
  const concepts = [
    ['Concept 1','Systematic review',['Systematic Reviews [MeSH]'],['systematic review','evidence synthesis','meta-analysis','rapid review']],
    ['Concept 2','Large language model',['Artificial Intelligence [MeSH]'],['large language model','LLM','generative AI','GPT','ChatGPT']],
    ['Concept 3','Screening workflow',[],['citation screening','study selection','title abstract screening','full text screening']],
  ];
  const query = `("Systematic Reviews as Topic"[Mesh] OR "systematic review*"[tiab] OR "evidence synthesis"[tiab] OR meta-analy*[tiab])\nAND\n("Artificial Intelligence"[Mesh] OR "large language model*"[tiab] OR LLM[tiab] OR ChatGPT[tiab] OR "generative AI"[tiab])\nAND\n("citation screening"[tiab] OR "study selection"[tiab] OR "title abstract screening"[tiab] OR "full text screening"[tiab])`;
  return `${header('Search strategy builder','构建可验证的检索策略','先维护数据库无关的概念与词表，再由规则编译器生成不同数据库的语法。', `<button class="ghost-button" data-action="import-search">${icon('upload')} 导入策略</button><button class="primary-button" data-action="validate-search">${icon('target')} 运行验证</button>`)}
    <div class="grid-2"><section class="panel"><div class="panel-head"><div><h3>概念与检索词</h3><p>3 个概念 · 15 个术语 · 最后保存于 2 分钟前</p></div><button class="soft-button" data-action="add-concept">${icon('plus')} 新增概念</button></div><div class="panel-body concept-list">${concepts.map(conceptCard).join('')}<div class="logic-box"><span class="logic-node">Systematic review</span><span class="operator">AND</span><span class="logic-node">Large language model</span><span class="operator">AND</span><span class="logic-node">Screening workflow</span></div></div></section>
    <section class="section-stack"><div class="panel"><div class="panel-head"><div><h3>哨兵文献召回</h3><p>已知相关研究验证</p></div><span class="badge amber">4 / 5</span></div><div class="panel-body"><div class="validation-score"><div class="score-ring"><strong>80%</strong></div><div><p><strong>1 篇关键文献未检出</strong></p><small>可能缺少 semi-automated screening。</small></div></div><button class="soft-button" style="width:100%;margin-top:12px" data-action="fix-search">查看修复建议</button></div></div>
    <div class="panel"><div class="panel-head"><div><h3>质量检查</h3><p>PRESS 检查要点</p></div><span class="badge green">7 / 8</span></div><div class="panel-body">${['布尔逻辑与括号','字段标签有效','主题词映射','无不当结局限制'].map(x=>`<div class="criterion-line">${icon('check')} ${x}</div>`).join('')}<div class="criterion-line exclude">${icon('alert')} 缺少一个常用同义词</div></div></div></section></div>
    <section class="panel"><div class="panel-head"><div><h3>数据库语法</h3><p>从统一表示自动编译，可人工微调</p></div><div class="tabs">${['PubMed','Embase','Web of Science','CENTRAL'].map(x=>`<button class="tab ${state.db===x?'active':''}" data-db="${x}">${x}</button>`).join('')}</div></div><div class="panel-body"><div class="code-box">${state.db==='PubMed'?query:`${state.db} 语法已根据当前概念图生成。\n\n${query.replaceAll('[tiab]', state.db==='Embase'?':ti,ab':'').replaceAll('[Mesh]','')}`}</div><div style="display:flex;justify-content:flex-end;margin-top:10px"><button class="ghost-button" data-action="copy-query">${icon('copy')} 复制检索式</button></div></div></section>`;
}

function conceptCard([idx,title,controlled,free]) { return `<article class="concept-card"><div class="concept-head"><span class="concept-index">${idx}</span><strong>${title}</strong><button class="icon-button" style="margin-left:auto;width:29px;height:29px" data-action="concept-more">${icon('more')}</button></div><div class="concept-body">${controlled.length?`<div class="term-group"><label>受控词</label><div class="chips">${controlled.map(x=>`<span class="chip controlled">${x}<span class="source">MeSH</span></span>`).join('')}</div></div>`:''}<div class="term-group"><label>自由词与变体</label><div class="chips">${free.map(x=>`<span class="chip">${x}<button data-action="remove-term">×</button></span>`).join('')}<button class="chip" data-action="add-term">${icon('plus',11)} 添加</button></div></div></div></article>`; }

function library() {
  const rows = [
    ['Large language models for screening systematic reviews','Martinez et al. · 2026','PubMed','2','Full text','100'],
    ['Semi-automated study selection using transformer models','Gates et al. · 2025','Embase','3','Full text','100'],
    ['Artificial intelligence in evidence synthesis','Ahmed et al. · 2026','Scopus','1','Abstract','62'],
    ['Human oversight of automated evidence review systems','Wang et al. · 2024','WoS','2','Full text','100'],
    ['Automation bias in clinical research workflows','Singh et al. · 2025','PubMed','1','Missing','35'],
  ];
  return `${header('Citation library','管理检索结果与全文','保留文献来源、导入批次、去重关系和全文获取状态，以便自动生成 PRISMA 流程。', `<button class="ghost-button" data-action="dedupe">${icon('layers')} 运行去重</button><button class="primary-button" data-action="import">${icon('upload')} 导入文献</button>`)}
  <div class="stats-grid">${[['原始记录','18,426'],['去重后','12,310'],['已关联全文','1,284'],['待获取全文','37']].map((x,i)=>`<div class="stat-card"><div class="stat-top">${x[0]}<span class="badge ${i===3?'amber':'gray'}">${['+2,716','66.8%','94.1%','需处理'][i]}</span></div><div class="stat-value">${x[1]}</div></div>`).join('')}</div>
  <section class="panel"><div class="panel-head"><div><h3>全部文献</h3><p>12,310 条唯一记录</p></div><span class="badge green">元数据已同步</span></div><div class="panel-body"><div class="toolbar"><div class="filter-input">${icon('search')}<input placeholder="按题目、作者、DOI 搜索" /></div><select class="select"><option>全部来源</option><option>PubMed</option><option>Embase</option></select><select class="select"><option>全部全文状态</option><option>已获取</option><option>缺失</option></select><span class="spacer"></span><button class="ghost-button">${icon('filter')} 筛选</button></div></div><div class="table-wrap"><table><thead><tr><th><input type="checkbox"></th><th>文献</th><th>首个来源</th><th>数据库命中</th><th>全文</th><th>完整度</th><th></th></tr></thead><tbody>${rows.map(r=>`<tr><td><input type="checkbox"></td><td class="title-cell"><strong>${r[0]}</strong><small>${r[1]} · DOI 10.1016/j.jclinepi.2026.${Math.floor(Math.random()*9000+1000)}</small></td><td><span class="source-pill">${r[2]}</span></td><td>${r[3]}</td><td><span class="badge ${r[4]==='Missing'?'amber':'green'}">${r[4]}</span></td><td class="progress-cell"><div class="progress-track"><span style="width:${r[5]}%"></span></div></td><td><button class="icon-button">${icon('more')}</button></td></tr>`).join('')}</tbody></table></div></section>`;
}

function screening() {
  if (state.screenMode === 'batch') return batchScreening();
  const c = screeningCases[state.screeningIndex];
  const highlighted = c.abstract.replace(c.evidence, `<mark class="evidence-highlight">${c.evidence}</mark>`);
  return `${header('Title and abstract screening','题目与摘要初筛','当前为盲法模式。请先独立判断，提交后才显示 AI 结论，以减少锚定效应。', `<div class="tabs"><button class="tab active">单篇模式</button><button class="tab" data-screen-mode="batch">批量模式</button></div>`)}
  <div class="screen-layout"><article class="citation-card"><div class="citation-meta"><span>Record #4,128</span><span>${c.authors}</span><span>${c.journal}</span><span class="badge blue">Blind mode</span></div><div class="citation-main"><h3>${c.title}</h3><p>${highlighted}</p></div><div class="decision-bar"><div><div class="decision-group"><button class="decision-button include ${state.decision==='Include'?'selected':''}" data-decision="Include">${icon('check')} 纳入</button><button class="decision-button exclude ${state.decision==='Exclude'?'selected':''}" data-decision="Exclude">${icon('x')} 排除</button><button class="decision-button uncertain ${state.decision==='Uncertain'?'selected':''}" data-decision="Uncertain">${icon('alert')} 待定</button></div><div class="keyboard-hints" style="margin-top:8px"><span><kbd>1</kbd> 纳入</span><span><kbd>2</kbd> 排除</span><span><kbd>3</kbd> 待定</span></div></div><div class="case-position">${state.screeningIndex+1} / 128 待处理</div></div></article>
  <aside class="criteria-rail"><div class="rail-card"><h4>关键纳入标准</h4>${[['P1','真实系统综述任务'],['I1','使用大语言模型'],['O1','报告筛选质量'],['S1','原始验证研究']].map(x=>`<div class="rail-item"><div class="criterion-id">${x[0]}</div><span>${x[1]}</span></div>`).join('')}</div><div class="rail-card"><h4>当前工作模式</h4><p class="muted" style="font-size:9px;line-height:1.5">你的判断与 AI 判断相互独立。仅在提交后展示一致性，并将分歧发送至裁决中心。</p></div></aside></div>`;
}

function batchScreening() {
  return `${header('Title and abstract screening','批量筛选','按 AI 结论、不确定性、排除理由和人机冲突快速定位需要人工处理的记录。', `<div class="tabs"><button class="tab" data-screen-mode="single">单篇模式</button><button class="tab active">批量模式</button></div>`)}<section class="panel"><div class="panel-body"><div class="toolbar"><div class="filter-input">${icon('search')}<input placeholder="搜索待筛文献" /></div><select class="select"><option>AI 待定</option><option>AI 高置信排除</option><option>全部</option></select><select class="select"><option>所有标准</option><option>P1 研究对象</option><option>S1 研究设计</option></select><span class="spacer"></span><button class="ghost-button">批量确认</button></div></div><div class="table-wrap"><table><thead><tr><th><input type="checkbox"></th><th>文献</th><th>AI 判断</th><th>置信程度</th><th>关键标准</th><th>人工判断</th></tr></thead><tbody>${screeningCases.concat(screeningCases).map((c,i)=>`<tr><td><input type="checkbox"></td><td class="title-cell"><strong>${c.title}</strong><small>${c.authors}</small></td><td><span class="badge ${c.ai==='Include'?'green':c.ai==='Exclude'?'red':'amber'}">${c.ai}</span></td><td>${c.confidence}</td><td>${c.criterion}</td><td><select class="select"><option>待处理</option><option>纳入</option><option>排除</option><option>待定</option></select></td></tr>`).join('')}</tbody></table></div></section>`;
}

function fulltext() {
  return `${header('Full text screening','全文证据核对','AI 已把每项纳入标准定位到原文。点击右侧标准可跳转到相应证据。', `<button class="ghost-button" data-action="replace-pdf">${icon('upload')} 替换 PDF</button><button class="primary-button" data-action="fulltext-decision">提交判断</button>`)}<div class="pdf-layout"><div class="pdf-viewer"><article class="pdf-page"><div style="color:#777;font-size:9px">Research Synthesis Methods · Original Article</div><h2>Human and large language model collaboration for systematic review screening: a randomized crossover study</h2><p><b>Emma Robinson, PhD; Kai Zhang, MSc; et al.</b></p><h3>Abstract</h3><p>We evaluated two human and artificial intelligence collaboration workflows for citation screening across eight completed systematic reviews.</p><h3>Methods</h3><p class="marked">We recruited 24 systematic reviewers with at least two years of evidence synthesis experience. Each reviewer completed both an AI-assisted workflow and an independent parallel workflow in randomized order.</p><p>The review corpus contained 8,420 citations. The reference standard was established by two senior reviewers and an independent adjudicator. The primary outcome was sensitivity for eligible studies. Secondary outcomes included time, workload, AI error adoption, and disagreement resolution accuracy.</p><h3>Results</h3><p class="marked">The parallel workflow achieved a sensitivity of 98.7% and reduced direct human screening by 61.2%. When an incorrect AI recommendation was shown before human judgment, reviewers adopted the error in 13.4% of cases.</p><p>Human experience moderated the effect of AI assistance. Evidence-linked explanations were associated with faster resolution of disagreements.</p><h3>Discussion</h3><p>Selective escalation based on uncertainty and error consequence may offer a safer route to deployment than uniform automation.</p></article></div><aside class="eligibility-card"><div class="panel-head"><div><h3>Eligibility</h3><p>4 项明确 · 1 项需确认</p></div></div>${[['P1','真实系统综述团队','pass','24 名综述研究人员'],['I1','LLM 参与筛选','pass','两种人机协作流程'],['C1','有效对照','pass','随机交叉设计'],['O1','质量与效率结局','pass','敏感度、时间、工作量'],['S1','原始比较研究','warn','需确认是否满足预注册要求']].map(x=>`<div class="eligibility-row" data-action="jump-evidence"><header><span class="status-symbol ${x[2]}">${x[2]==='pass'?'✓':'?'}</span><strong>${x[0]} · ${x[1]}</strong></header><p>${x[3]}</p></div>`).join('')}<div style="padding:14px"><div class="decision-group"><button class="decision-button include" data-action="full-include">纳入</button><button class="decision-button exclude" data-action="full-exclude">排除</button></div></div></aside></div>`;
}

function extraction() {
  const studies = [
    ['Robinson 2026','RCT crossover','24','8,420','Parallel review','98.7%','61.2%'],
    ['Martinez 2026','Retrospective','12 reviews','31,428','Selective review','98.2%','81.4%'],
    ['Gates 2025','Prospective','16','14,850','AI first','96.4%','72.8%'],
    ['Wang 2024','Simulation','42','6,200','AI advice','93.1%','44.6%'],
  ];
  return `${header('Structured data extraction','结构化数据提取','每个字段都保留原文证据、页码、AI 置信程度和人工核验状态。', `<button class="ghost-button" data-action="schema">${icon('settings')} 字段设置</button><button class="primary-button" data-action="export-csv">${icon('download')} 导出 CSV</button>`)}
  <div class="stats-grid">${[['已纳入研究','42'],['提取完成','18'],['待人工核验','126'],['字段冲突','18']].map((x,i)=>`<div class="stat-card"><div class="stat-top">${x[0]}<span class="badge ${i>1?'amber':'green'}">${['总计','42.9%','单元格','跨来源'][i]}</span></div><div class="stat-value">${x[1]}</div></div>`).join('')}</div>
  <section class="panel"><div class="panel-head"><div><h3>研究特征与主要结局</h3><p>点击任意单元格查看原始证据</p></div><div class="tabs"><button class="tab active">研究特征</button><button class="tab">结局</button><button class="tab">协作指标</button></div></div><div class="table-wrap"><table class="sheet"><thead><tr><th class="study-col">Study</th><th>Design</th><th>Reviewers</th><th>Citations</th><th>Workflow</th><th>Sensitivity</th><th>Workload reduction</th></tr></thead><tbody>${studies.map((r,ri)=>`<tr>${r.map((v,i)=>`<td class="${i===0?'study-col':''}"><div class="data-cell ${ri===2&&i===6?'low':''}" data-cell="${v}" data-source="${ri+3}">${v}${ri<2&&i>1?'<span class="verified">✓</span>':''}</div></td>`).join('')}</tr>`).join('')}</tbody></table></div><div class="sheet-footer"><span>4 / 42 studies · 28 fields</span><span>Last autosaved just now</span></div></section>`;
}

function rob() {
  const domains = [
    ['D1','Randomization process',['Sequence generation described','Allocation concealed'],'Low risk','green'],
    ['D2','Deviations from intended workflow',['Participants aware of AI','Appropriate analysis used'],'Some concerns','amber'],
    ['D3','Missing outcome data',['Outcome data available for 98%','Missingness balanced'],'Low risk','green'],
    ['D4','Measurement of outcomes',['Reference standard blinded','Timing captured automatically'],'Low risk','green'],
    ['D5','Selection of reported result',['Protocol available','Analysis plan specified'],'High risk','red'],
  ];
  return `${header('Risk of bias','偏倚风险评价','人工与 AI 先独立完成 signaling questions，再对分歧逐项裁决。', `<button class="ghost-button" data-action="rob-guide">查看 RoB 2 指南</button><button class="primary-button" data-action="next-study">下一项研究 ${icon('arrow')}</button>`)}<section class="panel"><div class="panel-head"><div><h3>Robinson et al. 2026</h3><p>Randomized crossover study · RoB 2 adapted workflow</p></div><span class="badge amber">1 项分歧</span></div>${domains.map(d=>`<div class="rob-domain"><div><div class="criterion-id" style="margin-bottom:8px">${d[0]}</div><h4>${d[1]}</h4><small>2 signaling questions</small></div><div class="signal-list">${d[2].map((x,i)=>`<div class="signal"><span>${x}</span><b>${i===0?'Yes':'Probably yes'}</b></div>`).join('')}</div><div class="judgement"><span class="badge ${d[4]}">${d[2][0]==='Protocol available'?'AI: High risk':`AI: ${d[2][0].includes('Participants')?'Some concerns':'Low risk'}`}</span><span class="badge gray">Human: ${d[3]}</span>${d[0]==='D5'?'<button class="soft-button" data-nav="adjudication">处理分歧</button>':''}</div></div>`).join('')}</section>`;
}

function adjudication() {
  return `${header('Adjudication center','冲突裁决中心','并排查看独立判断、理由、原文证据和方案标准，不默认人工或 AI 一方正确。', `<button class="ghost-button" data-action="skip">暂时跳过</button><button class="primary-button" data-action="next-conflict">下一个冲突 ${icon('arrow')}</button>`)}<section class="panel"><div class="panel-head"><div><h3>Conflict #021 · Title and abstract screening</h3><p>Large language models for automated title and abstract screening...</p></div><span class="badge red">高影响</span></div><div class="panel-body"><div class="compare-grid">
    ${reviewer('JL','Reviewer A','Include','研究评估真实综述任务中的题目摘要筛选，符合所有核心标准。','The model classified each record as include, exclude, or uncertain.','green')}
    ${reviewer('WQ','Reviewer B','Exclude','研究并未明确报告前瞻性部署，可能不满足 S1 的研究设计定义。','We conducted a multicenter retrospective evaluation.','red')}
    ${reviewer('AI','Qiuzheng AI','Include','S1 同时允许回顾性验证，研究明确报告多中心原始数据，应纳入。','Twelve systematic reviews from four clinical domains were included.','purple')}
  </div><div class="resolve-box"><div><strong>最终裁决</strong><div class="muted" style="font-size:9px;margin-top:3px">裁决将写入审计日志，并用于计算 AI rescue rate 和 human override rate。</div></div><div class="decision-group"><button class="decision-button include" data-resolution="Include">纳入</button><button class="decision-button exclude" data-resolution="Exclude">排除</button><button class="decision-button uncertain" data-resolution="Uncertain">待定</button></div></div></div></section>
  <div class="grid-equal" style="margin-top:16px"><section class="panel"><div class="panel-head"><h3>相关方案标准</h3><span class="badge blue">S1</span></div><div class="panel-body"><div class="criterion-line">${icon('check')}<span><b>S1</b> · 前瞻或回顾性原始验证研究均可纳入</span></div><div class="criterion-line exclude">${icon('x')}<span><b>S3</b> · 无原始数据的观点和综述排除</span></div></div></section><section class="panel"><div class="panel-head"><h3>本项目冲突概览</h3><span class="badge green">34 remaining</span></div><div class="panel-body"><div class="stats-grid" style="grid-template-columns:repeat(3,1fr);margin:0"><div><b>78.4%</b><small class="muted" style="display:block">初始一致率</small></div><div><b>12.1%</b><small class="muted" style="display:block">AI rescue</small></div><div><b>8.6%</b><small class="muted" style="display:block">Human override</small></div></div></div></section></div>`;
}

function reviewer(initial,role,decision,reason,quote,color) { return `<article class="reviewer-card"><div class="reviewer-head"><div class="avatar">${initial}</div><div><strong>${role}</strong><small>Independent decision</small></div></div><div class="reviewer-decision">${decision}</div><span class="badge ${color}">${decision==='Include'?'符合标准':'存在分歧'}</span><p>${reason}</p><div class="quote">${quote}</div></article>`; }

function synthesis() {
  const reports = [
    ['report','PRISMA 流程图','从检索、去重与筛选日志自动生成','green'],
    ['search','完整检索策略附录','导出所有数据库版本与检索日期','blue'],
    ['table','研究特征表','包含字段证据和核验状态','purple'],
    ['shield','偏倚风险结果','生成研究级与领域级图表','amber'],
    ['chart','Meta-analysis 数据','导出 RevMan、R 与 Stata 格式','green'],
    ['users','人机协作指标','Agreement、override、rescue 与 workload','red'],
  ];
  return `${header('Synthesis and reporting','证据综合与报告','当前项目尚未完成全部提取，可先生成带待办标记的报告草稿。')}<div class="report-hero"><div><h2>报告就绪度 68%</h2><p>完成 18 项数据提取与 24 项偏倚风险裁决后，可生成正式版本。</p></div><button class="primary-button" data-action="generate-draft">${icon('spark')} 生成报告草稿</button></div><div class="report-grid">${reports.map(r=>`<article class="report-card" data-action="report-card"><div class="report-card-icon badge ${r[3]}">${icon(r[0])}</div><strong>${r[1]}</strong><p>${r[2]}</p><button class="link-button">预览 ${icon('arrow',12)}</button></article>`).join('')}</div><div class="grid-equal" style="margin-top:18px"><section class="panel"><div class="panel-head"><div><h3>主要协作指标</h3><p>基于已完成的题目摘要筛选</p></div></div><div class="panel-body"><div class="stats-grid" style="grid-template-columns:repeat(2,1fr);margin:0">${[['Agreement','91.7%'],['AI rescue','12.1%'],['Human override','8.6%'],['Workload reduction','61.2%']].map(x=>`<div><small class="muted">${x[0]}</small><div style="font-size:22px;font-weight:700;margin-top:5px">${x[1]}</div></div>`).join('')}</div></div></section><section class="panel"><div class="panel-head"><div><h3>待完成事项</h3><p>按报告影响排序</p></div></div><div class="panel-body task-list">${taskRow('table','amber','完成数据核验','126 个单元格',126,'extraction')}${taskRow('shield','red','完成 RoB 裁决','24 个领域',24,'rob')}</div></section></div>`;
}

function audit() {
  const events = [
    ['你','裁决冲突 #021 为纳入','最终判断覆盖 Reviewer B；理由：S1 明确允许回顾性验证。','2026-09-17 15:42','Decision v1.4'],
    ['Qiuzheng AI','完成批次 screening-b042','处理 642 条记录；自动升级 53 条，模型 qwen3-14b-lora-r6。','2026-09-17 15:18','Prompt screen-2.3'],
    ['王巧','修改方案标准 P2','原定义需前瞻性部署，现改为前瞻或回顾性真实数据验证。','2026-09-17 14:36','Protocol v1.3 → v1.4'],
    ['系统','生成方案影响分析','识别到 216 条历史判断可能受影响，其中 28 条为高风险。','2026-09-17 14:37','Impact job #812'],
    ['你','导入 PubMed 检索结果','导入 2,716 条记录；新记录 1,928 条；重复 788 条。','2026-09-17 10:04','Search v3'],
  ];
  return `${header('Audit trail','完整审计记录','追踪人工、AI 与规则系统的每一次操作，记录方案、模型、提示词和数据版本。', `<button class="ghost-button" data-action="audit-filter">${icon('filter')} 筛选</button><button class="primary-button" data-action="export-audit">${icon('download')} 导出日志</button>`)}<section class="panel"><div class="panel-body"><div class="toolbar"><div class="filter-input">${icon('search')}<input placeholder="搜索操作、用户或版本" /></div><select class="select"><option>全部操作者</option><option>Human</option><option>AI</option><option>System</option></select><select class="select"><option>全部模块</option><option>Protocol</option><option>Screening</option></select></div><div class="audit-timeline">${events.map(e=>`<article class="audit-event"><header><strong>${e[0]} · ${e[1]}</strong><time>${e[3]}</time></header><p>${e[2]}</p><code>${e[4]}</code></article>`).join('')}</div></div></section>`;
}

function aiPanel() {
  const c = screeningCases[state.screeningIndex];
  const context = {
    dashboard: ['今日优先事项','建议先处理 34 条人机冲突，再检查检索遗漏的哨兵文献。'],
    protocol: ['方案质控','当前方案结构完整。P2 的修改会影响 216 条既往记录，建议先复核其中 28 条高风险决策。'],
    search: ['检索策略诊断','当前检索式通过 7 项 PRESS 检查，但只召回 4/5 篇哨兵文献。'],
    library: ['文献库状态','去重后保留 12,310 条记录，37 篇全文仍未获取。'],
    screening: [state.decision ? `AI 判断：${c.ai}` : '盲法判断中', state.decision ? c.reason : '提交你的独立判断后，AI 结论、证据和分歧解释会在这里显示。'],
    fulltext: ['AI 判断：倾向纳入','四项标准有直接证据支持，S1 需要确认预注册要求。'],
    extraction: ['字段证据','选择任意单元格，我会显示来源页码、原文片段和冲突检测结果。'],
    rob: ['偏倚风险建议','D5 可能为高风险。论文没有可核验的预注册分析计划。'],
    adjudication: ['冲突分析','Reviewer B 可能使用了旧版 S1。当前 v1.4 明确允许回顾性验证。'],
    synthesis: ['报告准备情况','当前可生成草稿，但 RoB 与数据提取仍有未核验项，正式报告会标记为未锁定。'],
    audit: ['审计助手','你可以按方案版本、模型版本、操作者或时间范围定位记录。'],
  }[state.active] || ['AI 协作','选择一个模块开始。'];
  return `<aside class="ai-panel ${state.aiOpen?'open':''}"><div class="ai-head"><div class="ai-title"><div class="ai-orb">${icon('spark')}</div><div><strong>Qiuzheng AI</strong><small>Context aware · Evidence linked</small></div><button class="icon-button" style="margin-left:auto;width:29px;height:29px" data-action="ai-close">${icon('x')}</button></div></div><div class="ai-tabs">${[['decision','判断'],['evidence','证据'],['criteria','标准'],['ask','询问']].map(x=>`<button class="ai-tab ${state.aiTab===x[0]?'active':''}" data-ai-tab="${x[0]}">${x[1]}</button>`).join('')}</div><div class="ai-content"><div class="ai-summary"><header><strong>${context[0]}</strong><span class="badge ${state.active==='screening'&&!state.decision?'gray':'green'}">${state.active==='screening'&&!state.decision?'Hidden':'Ready'}</span></header><p>${context[1]}</p></div>${aiTabContent(c)}</div><div class="ai-compose"><div class="compose-box"><textarea placeholder="询问当前任务，或要求 AI 核对证据…"></textarea><div class="compose-actions"><small>回答会引用当前项目内容</small><button class="send-button" data-action="send">${icon('send')}</button></div></div></div></aside>`;
}

function aiTabContent(c) {
  if (state.aiTab === 'evidence') return `<div class="ai-section"><h4>关键原文</h4><div class="evidence-quote">${state.active==='screening' && state.decision ? c.evidence : '选择具体记录或字段后显示可核验的原文证据。'}</div></div><div class="ai-section"><h4>来源</h4><p>${state.active==='fulltext'?'Methods, page 3 · Results, page 6':'Title and abstract record · Imported metadata'}</p></div>`;
  if (state.aiTab === 'criteria') return `<div class="ai-section"><h4>引用的方案标准</h4><ul><li>P1 · 真实系统综述任务</li><li>I1 · 大语言模型参与工作流</li><li>S1 · 原始验证研究</li></ul></div><div class="ai-section"><h4>版本</h4><p>Protocol v1.4 · Locked 2026-09-17</p></div>`;
  if (state.aiTab === 'ask') return `<div class="ai-section"><h4>可以这样问</h4><ul><li>为什么这条记录需要人工处理？</li><li>定位支持 S1 的原文证据</li><li>这个判断受哪次方案修改影响？</li><li>比较两位 reviewer 的理由</li></ul></div>`;
  return `<div class="ai-section"><h4>不确定性来源</h4><ul><li>${state.active==='search'?'术语覆盖可能不足':'研究设计信息基本充分'}</li><li>${state.active==='rob'?'预注册材料不可用':'方案标准之间无明显冲突'}</li></ul></div><div class="ai-section"><h4>建议操作</h4><p>${state.active==='screening'&&!state.decision?'先完成独立判断。':'打开证据并核对对应标准，必要时升级至人工裁决。'}</p></div>`;
}

function modal() {
  if (!state.modal) return '';
  const configs = {
    criterion: ['编辑纳入排除标准', `<div class="form-grid"><div class="field"><label>标准 ID</label><input value="P2" /></div><div class="field"><label>类型</label><select><option>纳入标准</option><option>排除标准</option></select></div><div class="field full"><label>标准描述</label><textarea>研究任务包含至少 500 条待筛选记录</textarea></div><div class="field full"><label>修改理由</label><textarea placeholder="说明修改原因，以便记录版本和影响分析"></textarea></div></div>`],
    import: ['导入文献', `<div class="form-grid"><div class="field full"><label>文件格式</label><select><option>RIS</option><option>BibTeX</option><option>CSV</option><option>PubMed XML</option></select></div><div class="field full"><label>检索来源</label><input placeholder="例如 PubMed Search v3" /></div><div class="field full"><div style="border:1px dashed #b7c8c2;border-radius:13px;padding:35px;text-align:center;color:var(--ink-3)">${icon('upload',28)}<p>拖放文件到这里，或点击选择</p></div></div></div>`],
    settings: ['项目设置', `<div class="form-grid"><div class="field full"><label>项目名称</label><input value="LLM 辅助系统综述" /></div><div class="field"><label>Review 类型</label><select><option>Intervention</option><option>Diagnosis</option><option>Prognosis</option></select></div><div class="field"><label>默认协作模式</label><select><option>独立并行判断</option><option>AI 辅助判断</option></select></div><div class="field full"><label>自动升级规则</label><textarea>不确定性高、证据不足、标准冲突或错误后果较高时，升级至人工处理。</textarea></div></div>`],
    search: ['搜索项目内容', `<div class="filter-input" style="width:100%">${icon('search')}<input autofocus placeholder="搜索文献、标准、成员或操作记录" /></div><div class="empty-state" style="padding:28px">${icon('command')}<p>输入关键词开始跨模块搜索</p></div>`]
  };
  const [title,body] = configs[state.modal] || configs.settings;
  return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal"><div class="modal-head"><h3>${title}</h3><button class="icon-button" data-action="modal-close">${icon('x')}</button></div><div class="modal-body">${body}</div><div class="modal-actions"><button class="ghost-button" data-action="modal-close">取消</button><button class="primary-button" data-action="modal-save">保存</button></div></div></div>`;
}

function toast(message) {
  const root = document.getElementById('toast-root');
  const el = document.createElement('div');
  el.className = 'toast'; el.innerHTML = `${icon('check')} ${message}`; root.appendChild(el);
  setTimeout(() => el.remove(), 2800);
}

function bindEvents() {
  document.querySelectorAll('[data-nav]').forEach(el => el.addEventListener('click', () => { state.active = el.dataset.nav; state.sidebarOpen = false; state.decision = null; window.scrollTo(0,0); app(); }));
  document.querySelectorAll('[data-ai-tab]').forEach(el => el.addEventListener('click', () => { state.aiTab = el.dataset.aiTab; app(); }));
  document.querySelectorAll('[data-db]').forEach(el => el.addEventListener('click', () => { state.db = el.dataset.db; app(); }));
  document.querySelectorAll('[data-screen-mode]').forEach(el => el.addEventListener('click', () => { state.screenMode = el.dataset.screenMode; app(); }));
  document.querySelectorAll('[data-decision]').forEach(el => el.addEventListener('click', () => {
    state.decision = el.dataset.decision; state.aiOpen = true; app();
    setTimeout(() => toast(state.decision === screeningCases[state.screeningIndex].ai ? '已提交，与 AI 判断一致' : '已提交，分歧已发送至裁决中心'), 30);
    setTimeout(() => { state.screeningIndex = (state.screeningIndex + 1) % screeningCases.length; state.decision = null; app(); }, 2300);
  }));
  document.querySelectorAll('[data-resolution]').forEach(el => el.addEventListener('click', () => { toast(`最终裁决已记录：${el.dataset.resolution}`); }));
  document.querySelectorAll('[data-cell]').forEach(el => el.addEventListener('click', () => { state.aiOpen = true; app(); setTimeout(()=>toast(`已定位 ${el.dataset.cell} 的原文证据，第 ${el.dataset.source} 页`),50); }));
  document.querySelectorAll('[data-action]').forEach(el => el.addEventListener('click', event => handleAction(el.dataset.action, event)));
  document.addEventListener('keydown', keyboardHandler, { once: true });
}

function keyboardHandler(e) {
  if (state.active === 'screening' && state.screenMode === 'single' && ['1','2','3'].includes(e.key)) {
    state.decision = {'1':'Include','2':'Exclude','3':'Uncertain'}[e.key]; state.aiOpen = true; app(); toast('判断已提交');
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); state.modal='search'; app(); }
}

function handleAction(action, event) {
  if (action === 'menu') { state.sidebarOpen = !state.sidebarOpen; app(); return; }
  if (action === 'ai-toggle') { state.aiOpen = !state.aiOpen; app(); return; }
  if (action === 'ai-close') { state.aiOpen = false; app(); return; }
  if (action === 'global-search') { state.modal = 'search'; app(); return; }
  if (action === 'settings') { state.modal = 'settings'; app(); return; }
  if (action === 'import' || action === 'import-search') { state.modal = 'import'; app(); return; }
  if (['edit-criterion','add-criterion','edit-question'].includes(action)) { state.modal = 'criterion'; app(); return; }
  if (action === 'modal-backdrop' && event.target !== event.currentTarget) return;
  if (action === 'modal-close' || action === 'modal-backdrop') { state.modal = null; app(); return; }
  if (action === 'modal-save') { state.modal = null; app(); toast('修改已保存，并创建新的审计记录'); return; }
  if (action === 'copy-query') { navigator.clipboard?.writeText('Qiuzheng generated search strategy'); toast('检索式已复制'); return; }
  if (action === 'remove-term') { event.stopPropagation(); event.currentTarget.closest('.chip')?.remove(); toast('术语已移除'); return; }
  if (action === 'send') { const ta = event.currentTarget.closest('.compose-box').querySelector('textarea'); if (ta.value.trim()) { ta.value=''; toast('问题已发送，回答将引用当前证据'); } return; }
  const messages = {
    'validate-search':'检索验证已开始，正在测试 5 篇哨兵文献', 'fix-search':'已生成修复建议：补充 semi-automated screening',
    'dedupe':'去重任务已开始，将保留所有来源关系', 'export-csv':'已生成数据提取 CSV', 'export-audit':'审计日志已导出',
    'generate-draft':'报告草稿正在生成，未完成项目将被明确标记', 'recheck':'已创建 28 条高风险复核任务',
    'fulltext-decision':'全文判断已保存', 'full-include':'已纳入并进入数据提取', 'full-exclude':'请选择排除标准',
    'jump-evidence':'已跳转并高亮对应原文证据', 'next-study':'已保存，打开下一项研究', 'next-conflict':'已打开下一个冲突',
    'report-card':'正在生成预览', 'export':'项目状态已导出', 'notification':'目前有 5 条新通知', 'team':'项目共有 6 名成员',
    'project':'项目切换器将在后端接入后启用', 'replace-pdf':'请选择新的 PDF 文件', 'schema':'提取字段设置已打开',
    'history':'当前共 4 个方案版本', 'workflow-detail':'项目计划共有 9 个阶段', 'rob-guide':'已打开 RoB 2 内置指南',
    'add-concept':'已添加空白概念卡片', 'add-term':'请输入新的检索词', 'concept-more':'可重命名、复制或删除该概念',
    'skip':'该冲突已移至队列末尾', 'audit-filter':'可按操作者、模块和时间筛选',
  };
  toast(messages[action] || '操作已记录');
}

app();
