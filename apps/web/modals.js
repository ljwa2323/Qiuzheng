import { modelSupportsThinking } from '@qiuzheng/shared';

export function buildModal(ctx) {
  const { state, icon, escapeHtml, searchableRecords, matchesQuery, extractionValue, highlightEvidenceHtml } = ctx;
  const extractionTypeLabels = { text: '文本', number: '数值', boolean: '是/否', select: '单选', date: '日期' };

  if (!state.modal) return '';
  const payload = state.modalPayload || {};
  const selectedCriterion = state.criteria.find((item) => item.id === payload.id);
  const selectedExtractionField = state.extractionFields.find((item) => item.id === payload.fieldId);
  const selectedExtractionCitation = state.citations.find((item) => item.id === payload.citationId);
  const selectedExtractionValue = extractionValue(payload.citationId, payload.fieldId);
  const extractionSourceText = selectedExtractionCitation
    ? (selectedExtractionCitation.fullTextMarkdown || selectedExtractionCitation.raw?.fullTextMarkdown || selectedExtractionCitation.abstract || selectedExtractionCitation.raw?.abstract || '')
    : '';
  const extractionSourceKind = selectedExtractionCitation?.fullTextMarkdown || selectedExtractionCitation?.raw?.fullTextMarkdown
    ? 'Full text (Markdown)'
    : 'Abstract';
  const extractionTraceHtml = typeof highlightEvidenceHtml === 'function'
    ? highlightEvidenceHtml(extractionSourceText, selectedExtractionValue?.evidenceText || '')
    : escapeHtml(extractionSourceText || '');

  function searchModalBody() {
    const results = searchableRecords().filter((record) => matchesQuery([record.title, record.meta, record.type], state.searchQuery)).slice(0, 12);
    return `<label class="filter-input" style="width:100%">${icon('search')}<input autofocus data-search-input value="${escapeHtml(state.searchQuery)}" placeholder="搜索文献、标准或操作记录" /></label>${state.searchQuery ? `<div class="search-results">${results.length ? results.map((record) => `<button data-nav="${record.nav}"><span class="badge gray">${record.type}</span><strong>${escapeHtml(record.title)}</strong><small>${escapeHtml(record.meta)}</small></button>`).join('') : '<div class="empty-state"><p>没有找到匹配内容</p></div>'}</div>` : '<div class="empty-state"><p>输入关键词开始跨模块搜索</p></div>'}`;
  }

  const configs = {
    criterion: [selectedCriterion ? '编辑纳入排除标准' : '添加纳入排除标准', `<form class="form-grid" id="modal-form"><div class="field"><label for="criterion-id">标准 ID</label><input id="criterion-id" name="id" value="${escapeHtml(selectedCriterion?.id || '')}" maxlength="4" required /></div><div class="field"><label for="criterion-title">中文名称</label><input id="criterion-title" name="title" value="${escapeHtml(selectedCriterion?.title || '')}" required /></div><div class="field full"><label for="criterion-en">英文名称</label><input id="criterion-en" name="en" value="${escapeHtml(selectedCriterion?.en || '')}" /></div><div class="field full"><label for="criterion-include">纳入标准（每行一项）</label><textarea id="criterion-include" name="include" required>${escapeHtml(selectedCriterion?.include?.join('\n') || '')}</textarea></div><div class="field full"><label for="criterion-exclude">排除标准（每行一项）</label><textarea id="criterion-exclude" name="exclude">${escapeHtml(selectedCriterion?.exclude?.join('\n') || '')}</textarea></div><div class="field full"><label for="criterion-reason">修改理由</label><textarea id="criterion-reason" name="reason"></textarea></div></form>`],
    question: ['编辑研究问题', `<form class="form-grid" id="modal-form"><div class="field full"><label for="research-question">主要研究问题</label><textarea id="research-question" name="question" autofocus required>${escapeHtml(state.question)}</textarea></div><div class="field full"><label for="question-reason">修改理由</label><textarea id="question-reason" name="reason"></textarea></div></form>`],
    pico: ['编辑 PICO', (() => {
      const pico = state.pico || { p: '', i: '', c: '', o: '' };
      return `<form class="form-grid" id="modal-form">
<div class="field full"><label for="pico-p">P · Population / 人群</label><textarea id="pico-p" name="picoP" rows="2">${escapeHtml(pico.p || '')}</textarea></div>
<div class="field full"><label for="pico-i">I · Intervention / 干预</label><textarea id="pico-i" name="picoI" rows="2">${escapeHtml(pico.i || '')}</textarea></div>
<div class="field full"><label for="pico-c">C · Comparator / 对照</label><textarea id="pico-c" name="picoC" rows="2">${escapeHtml(pico.c || '')}</textarea></div>
<div class="field full"><label for="pico-o">O · Outcome / 结局</label><textarea id="pico-o" name="picoO" rows="2">${escapeHtml(pico.o || '')}</textarea></div>
<div class="field full"><label for="pico-reason">修改理由</label><textarea id="pico-reason" name="reason" placeholder="可选"></textarea></div>
</form>`;
    })()],
    concept: ['新增检索概念', `<form class="form-grid" id="modal-form"><div class="field full"><label for="concept-title">概念名称</label><input id="concept-title" name="title" autofocus required /></div></form>`],
    term: ['添加检索词', `<form class="form-grid" id="modal-form"><div class="field full"><label for="term-value">自由词或变体</label><input id="term-value" name="value" autofocus required /></div></form>`],
    import: ['导入文献', `<form class="form-grid" id="modal-form"><div class="field"><label for="import-format">文件格式</label><select id="import-format" name="format">${['RIS', 'BibTeX', 'CSV', 'PubMed XML', 'PubMed NBIB'].map((format) => `<option ${format === (payload.format || 'RIS') ? 'selected' : ''}>${format}</option>`).join('')}</select></div><div class="field"><label for="import-source">检索来源</label><input id="import-source" name="source" value="${escapeHtml(payload.source || '')}" /></div><div class="field full"><label class="drop-zone" for="import-file">${icon('upload', 28)}<strong>${payload.fileName ? escapeHtml(payload.fileName) : '选择 RIS、BibTeX、CSV、PubMed XML 或 NBIB 文件'}</strong>${payload.file ? `<span class="muted">${payload.citations?.length ? `本地预览约 ${payload.citations.length} 条，可上传` : '已选择文件，可上传'}</span>` : ''}</label><input class="visually-hidden" id="import-file" type="file" accept=".ris,.bib,.bibtex,.csv,.xml,.nbib,.txt,text/csv,application/xml,text/xml,text/plain" /></div>${payload.error ? `<div class="form-error field full">${escapeHtml(payload.error)}</div>` : ''}</form>`],
    'upload-fulltext': ['上传全文', (() => {
      const citation = state.citations.find((item) => item.id === payload.citationId) || payload;
      return `<form class="form-grid" id="modal-form"><div class="field full"><label>文献</label><div class="readonly-field">${escapeHtml(citation.title || '')}</div></div><div class="field full"><p class="muted" style="font-size:12px;line-height:1.6">上传 PDF 会自动抽取文本并生成 Markdown（供 AI 使用）；也可直接上传 .md。扫描件若无文字层，需另行提供 MD。</p></div><div class="field full"><label class="drop-zone" for="fulltext-file">${icon('upload', 28)}<strong>${payload.fileName ? escapeHtml(payload.fileName) : '选择 PDF 或 Markdown (.md) 文件'}</strong></label><input class="visually-hidden" id="fulltext-file" type="file" accept=".pdf,.md,.markdown,.txt,application/pdf,text/markdown,text/plain" /></div>${payload.error ? `<div class="form-error field full">${escapeHtml(payload.error)}</div>` : ''}</form>`;
    })()],
    'delete-fulltext': ['删除全文', (() => {
      const bits = [
        payload.hasPdf ? 'PDF' : '',
        payload.hasMd ? 'Markdown' : '',
      ].filter(Boolean).join(' + ') || '全文文件';
      return `<form id="modal-form"><div class="warning-box"><strong>删除「${escapeHtml(payload.title || '')}」的全文？</strong><p>将移除 ${escapeHtml(bits)}，并清空已抽取的 Markdown。摘要与筛选记录不受影响。此操作不可撤销。</p></div></form>`;
    })()],
    'delete-citations': ['删除文献', (() => {
      const items = payload.items || [];
      const totalCount = Number(payload.totalCount || items.length || 0);
      const riskyCount = Number(payload.riskyCount || 0);
      const safeCount = Number(payload.safeCount || Math.max(0, totalCount - riskyCount));
      const list = items.slice(0, 8).map((item) => {
        const tags = [
          item.screeningDecisions ? `筛选 ${item.screeningDecisions}` : '',
          item.hasFulltext ? '全文' : '',
          item.extractionValues ? `提取 ${item.extractionValues}` : '',
          item.robJudgements ? `RoB ${item.robJudgements}` : '',
        ].filter(Boolean).join(' · ');
        return `<li><strong>${escapeHtml(item.title || item.id)}</strong>${tags ? `<small class="muted"> · ${escapeHtml(tags)}</small>` : '<small class="muted"> · 仅导入</small>'}</li>`;
      }).join('');
      const more = totalCount > items.length
        ? `<p class="muted">……共 ${totalCount} 条，此处仅列出示例</p>`
        : (items.length > 8 ? `<p class="muted">……另有 ${items.length - 8} 条</p>` : '');
      return `<form id="modal-form"><div class="warning-box"><strong>确认删除 ${totalCount} 条文献？</strong><p>${riskyCount
        ? `<span class="badge red">${riskyCount} 条</span> 已有初筛 / 全文 / 提取 / RoB 数据，删除后下游结果一并丢失。`
        : '所选文献尚无深入处理记录，可安全清理。'} ${safeCount && riskyCount ? `另有 ${safeCount} 条为仅导入记录。` : ''}</p><ul class="delete-citation-list">${list}</ul>${more}<p class="muted" style="margin-top:10px">此操作不可撤销。</p></div></form>`;
    })()],
    settings: ['项目与模型设置', (() => {
      const currentCred = state.credentials.find((c) => c.id === state.credentialId);
      const embeddingCred = state.credentials.find((c) => c.id === state.embeddingCredentialId);
      const supportsThinking = modelSupportsThinking(currentCred?.defaultModel, currentCred?.provider);
      const savedList = state.credentials.length
        ? `<div class="field full"><label>已保存的凭据</label><div class="credential-list">${state.credentials.map((c) => {
            const badges = [
              c.id === state.credentialId ? '<span class="badge green">聊天</span>' : '',
              c.id === state.embeddingCredentialId ? '<span class="badge blue">Embedding</span>' : '',
            ].filter(Boolean).join('');
            return `<div class="credential-row ${c.id === state.credentialId || c.id === state.embeddingCredentialId ? 'active' : ''}"><strong>${escapeHtml(c.name)}</strong><small>${escapeHtml(c.provider)} · ${escapeHtml(c.defaultModel)} · ****${escapeHtml(c.apiKeyLast4)}${c.thinkingEnabled ? ' · Thinking 开' : ''}</small>${badges}</div>`;
          }).join('')}</div><p class="muted" style="font-size:11px;margin-top:6px">聊天与 Embedding 可使用不同凭据、不同 API Key；密钥仅服务端加密保存。</p></div>`
        : '<div class="field full"><div class="status-banner">还没有已保存的模型凭据。</div></div>';
      return `<form class="form-grid" id="modal-form">
<div class="field full"><label for="project-name">项目名称</label><input id="project-name" name="name" value="${escapeHtml(state.projectName)}" required /></div>
<div class="field full"><label for="project-description">项目说明</label><textarea id="project-description" name="description" rows="3" placeholder="可选：项目背景、范围或备注">${escapeHtml(state.projectDescription || '')}</textarea></div>
<div class="field full"><label for="llm-response-language">AI 回答语言</label><select id="llm-response-language" name="llmResponseLanguage"><option value="zh" ${state.llmResponseLanguage !== 'en' ? 'selected' : ''}>中文</option><option value="en" ${state.llmResponseLanguage === 'en' ? 'selected' : ''}>English</option></select><p class="muted" style="font-size:11px;margin-top:6px">固定注入到所有 AI 调用：自然语言字段按所选语言输出；原文证据引用保持不翻译。</p></div>
<div class="field full settings-section-title"><strong>PubMed / NCBI</strong><p class="muted" style="font-size:11px;margin:4px 0 0">用于检索策略生成时校验 MeSH 受控词（E-utilities）。无 Key 也可调用，但更容易限流。</p></div>
<div class="field full"><label for="pubmed-api-key">PubMed API Key</label><input id="pubmed-api-key" name="pubmedApiKey" type="password" autocomplete="off" placeholder="${state.hasPubmedApiKey ? `已保存 ****${escapeHtml(state.pubmedApiKeyLast4 || '')}；填写则更新` : '粘贴 NCBI Account 中的 API Key'}" /><label class="check-field" style="margin-top:8px"><input name="clearPubmedApiKey" type="checkbox" /> 清除已保存的 PubMed API Key</label></div>
${savedList}
<div class="field full settings-section-title"><strong>聊天模型凭据</strong><p class="muted" style="font-size:11px;margin:4px 0 0">用于筛选、提取、助手对话等 chat/completions 任务</p></div>
<div class="field full"><label for="credential-id">使用的聊天凭据</label><select id="credential-id" name="credentialId" data-settings-credential><option value="">未选择</option>${state.credentials.map((c) => `<option value="${c.id}" ${state.credentialId === c.id ? 'selected' : ''} data-provider="${escapeHtml(c.provider)}" data-model="${escapeHtml(c.defaultModel)}" data-thinking="${c.thinkingEnabled ? '1' : '0'}">${escapeHtml(c.name)} · ${c.provider} · ****${c.apiKeyLast4}</option>`).join('')}</select></div>
<div class="field full" id="thinking-field" ${supportsThinking ? '' : 'hidden'}><label class="check-field"><input id="cred-thinking" name="thinkingEnabled" type="checkbox" ${currentCred?.thinkingEnabled ? 'checked' : ''} /> 启用 Thinking（推理链）</label><p class="muted" style="font-size:11px;margin-top:6px">对 Qwen3 / Nemotron / DeepSeek-R1 等支持 thinking 的模型生效。</p></div>
<div class="field"><label for="cred-provider">聊天 Provider</label><select id="cred-provider" name="provider" data-settings-provider><option value="nvidia">NVIDIA NIM</option><option value="openai">OpenAI</option><option value="deepseek">DeepSeek</option><option value="azure">Azure OpenAI</option><option value="custom">Custom</option></select></div>
<div class="field"><label for="cred-model">默认聊天模型</label><input id="cred-model" name="defaultModel" data-settings-model placeholder="meta/llama-3.1-70b-instruct" value="" /></div>
<div class="field full"><label for="cred-name">聊天凭据名称</label><input id="cred-name" name="credName" placeholder="例如 NVIDIA chat" /></div>
<div class="field full"><label for="cred-base">聊天 Base URL</label><input id="cred-base" name="baseUrl" placeholder="https://integrate.api.nvidia.com/v1" /></div>
<div class="field full"><label for="cred-key">聊天 API Key</label><input id="cred-key" name="apiKey" type="password" autocomplete="off" placeholder="${currentCred ? `已保存 ****${currentCred.apiKeyLast4}；填写则新建聊天凭据` : '粘贴聊天 API Key'}" /></div>
<div class="field full settings-section-title"><strong>Embedding 模型凭据</strong><p class="muted" style="font-size:11px;margin:4px 0 0">用于原文证据定位；可与聊天完全独立（不同 Provider / Base URL / API Key）</p></div>
<div class="field full"><label for="embedding-credential-id">使用的 Embedding 凭据</label><select id="embedding-credential-id" name="embeddingCredentialId"><option value="">与聊天凭据相同</option>${state.credentials.map((c) => `<option value="${c.id}" ${state.embeddingCredentialId === c.id ? 'selected' : ''}>${escapeHtml(c.name)} · ${c.provider} · ****${c.apiKeyLast4}</option>`).join('')}</select></div>
<div class="field"><label for="emb-provider">Embedding Provider</label><select id="emb-provider" name="embProvider"><option value="openai">OpenAI</option><option value="nvidia">NVIDIA NIM</option><option value="azure">Azure OpenAI</option><option value="custom">Custom</option><option value="deepseek">DeepSeek</option></select></div>
<div class="field"><label for="embedding-model">Embedding 模型</label><input id="embedding-model" name="embeddingModel" value="${escapeHtml(state.embeddingModel || '')}" placeholder="text-embedding-3-small / nvidia/nv-embedqa-e5-v5" /></div>
<div class="field full"><label for="emb-name">Embedding 凭据名称</label><input id="emb-name" name="embName" placeholder="例如 OpenAI embedding" /></div>
<div class="field full"><label for="emb-base">Embedding Base URL</label><input id="emb-base" name="embBaseUrl" placeholder="https://api.openai.com/v1" /></div>
<div class="field full"><label for="emb-key">Embedding API Key</label><input id="emb-key" name="embApiKey" type="password" autocomplete="off" placeholder="${embeddingCred ? `已绑定 ****${embeddingCred.apiKeyLast4}；填写则新建独立 Embedding 凭据` : '粘贴 Embedding 专用 API Key（可与聊天不同）'}" /><p class="muted" style="font-size:11px;margin-top:6px">填写 Embedding API Key 后会新建独立凭据并绑定到本项目；不填则沿用上方所选 Embedding 凭据，或与聊天共用。</p></div>
<div class="field full settings-section-title"><strong>危险操作</strong><p class="muted" style="font-size:11px;margin:4px 0 0">删除项目将永久清除文献、筛选、提取、Meta 与综合等全部数据，不可撤销。仅项目 owner 可执行。</p></div>
<div class="field full"><button type="button" class="ghost-button danger-text" data-action="delete-project-start">${icon('x')} 删除项目</button></div>
</form>`;
    })()],
    'delete-project': ['删除项目', (() => {
      const step = Number(payload.step || 1);
      const name = escapeHtml(state.projectName || '');
      if (step <= 1) {
        return `<form id="modal-form"><div class="warning-box"><strong>第一次确认</strong><p>即将删除项目「${name}」。此操作会永久删除该项目下的全部研究数据（文献、筛选、提取、RoB、Meta、综合稿等）。</p><p class="muted" style="margin-top:8px">点击下方「继续删除」进入第二次确认。</p></div></form>`;
      }
      return `<form class="form-grid" id="modal-form"><div class="warning-box"><strong>第二次确认</strong><p>请输入项目全名 <code>${name}</code> 以确认永久删除。</p></div><div class="field full"><label for="delete-project-confirm-name">项目名称</label><input id="delete-project-confirm-name" name="confirmName" autocomplete="off" required placeholder="${name}" /></div><label class="check-field full"><input name="understood" type="checkbox" required /> 我已了解此操作不可撤销</label></form>`;
    })()],
    exclusion: ['记录全文排除理由', `<form class="form-grid" id="modal-form"><div class="field full"><label for="exclude-reason">排除标准</label><select id="exclude-reason" name="reason"><option value="S1">S1 · 研究设计不符</option><option value="P1">P1 · 研究对象不符</option><option value="I1">I1 · 未使用大语言模型</option><option value="O1">O1 · 未报告目标结局</option></select></div><div class="field full"><label for="exclude-note">说明</label><textarea id="exclude-note" name="note"></textarea></div></form>`],
    'extraction-field': [selectedExtractionField ? '编辑提取字段' : '新建提取字段', `<form class="form-grid" id="modal-form"><div class="field"><label for="extract-label">字段名称</label><input id="extract-label" name="label" value="${escapeHtml(selectedExtractionField?.label || '')}" required /></div><div class="field"><label for="extract-key">字段标识</label><input id="extract-key" name="key" value="${escapeHtml(selectedExtractionField?.key || '')}" required pattern="[a-z][a-z0-9_]*" /></div><div class="field"><label for="extract-type">字段类型</label><select id="extract-type" name="dataType">${Object.entries(extractionTypeLabels).map(([value, label]) => `<option value="${value}" ${value === (selectedExtractionField?.dataType || 'text') ? 'selected' : ''}>${label}</option>`).join('')}</select></div><div class="field full"><label for="extract-description">提取说明</label><textarea id="extract-description" name="description">${escapeHtml(selectedExtractionField?.description || '')}</textarea></div><div class="field full"><label for="extract-options">选项（仅单选）</label><textarea id="extract-options" name="options">${escapeHtml(selectedExtractionField?.options?.join('\n') || '')}</textarea></div><label class="check-field"><input name="required" type="checkbox" ${selectedExtractionField?.required ? 'checked' : ''} /> 设为必填字段</label><p class="muted field full" style="font-size:11px;margin:0">字段顺序请在「字段管理」中拖动调整。</p></form>`],
    'extraction-value': ['填写提取值', `<form class="form-grid" id="modal-form"><div class="field full"><label>研究</label><div class="readonly-field">${escapeHtml(selectedExtractionCitation?.title || '')}</div></div><div class="field full"><label for="extract-value">${escapeHtml(selectedExtractionField?.label || '字段值')}</label>${selectedExtractionField?.dataType === 'select' ? `<select id="extract-value" name="value"><option value="">请选择</option>${(selectedExtractionField.options || []).map((option) => `<option ${option === selectedExtractionValue?.value ? 'selected' : ''}>${escapeHtml(option)}</option>`).join('')}</select>` : `<input id="extract-value" name="value" value="${escapeHtml(selectedExtractionValue?.value || '')}" ${selectedExtractionField?.required ? 'required' : ''} />`}</div><div class="field full"><label for="extract-evidence">对应原文证据</label><textarea id="extract-evidence" name="evidenceText">${escapeHtml(selectedExtractionValue?.evidenceText || '')}</textarea></div><div class="field"><label for="extract-location">来源位置</label><input id="extract-location" name="sourceLocation" value="${escapeHtml(selectedExtractionValue?.sourceLocation || extractionSourceKind)}" /></div><div class="field"><label for="extract-confidence">置信程度</label><select id="extract-confidence" name="confidence"><option value="">未标记</option>${['High', 'Moderate', 'Low'].map((value) => `<option ${value === selectedExtractionValue?.confidence ? 'selected' : ''}>${value}</option>`).join('')}</select></div><label class="check-field full"><input name="verified" type="checkbox" ${selectedExtractionValue?.verified ? 'checked' : ''} /> 已由人工核验原文</label><div class="field full extract-trace-panel"><label>原文回溯（${escapeHtml(extractionSourceKind)}）</label><div class="extract-trace-body">${extractionTraceHtml}</div><p class="muted extract-trace-hint">高亮片段即当前证据在原文中的位置；修改上方「对应原文证据」后需保存再打开以刷新高亮。</p></div></form>`],
    'delete-extraction-field': ['删除提取字段', (() => {
      const label = escapeHtml(selectedExtractionField?.label || '');
      return `<form id="modal-form"><div class="warning-box"><strong>删除「${label}」？</strong><p>将永久删除该字段，以及所有研究中已填写的提取值。此操作不可撤销。</p></div></form>`;
    })()],
    search: ['搜索项目内容', searchModalBody()],
    notifications: ['通知', state.audits.length ? `<div class="notice-list">${state.audits.slice(0, 5).map((e) => `<button data-nav="audit"><strong>${escapeHtml(e.action)}</strong><span>${escapeHtml(e.detail)}</span></button>`).join('')}</div>` : '<div class="empty-state"><p>暂无通知</p></div>'],
    team: ['项目团队', `<div class="member-list">${(state.projectMembers || []).map((m) => `<div class="member-row"><span class="avatar">${escapeHtml((m.user?.name || '?').slice(0, 2))}</span><div><strong>${escapeHtml(m.user?.name || '')}</strong><small>${escapeHtml(m.role)} · ${escapeHtml(m.user?.email || '')}</small></div></div>`).join('') || '<div class="empty-state"><p>暂无成员信息</p></div>'}</div>`],
    'import-screening-diff': ['导入初筛 Diff（Reviewer B）', (() => {
      const result = payload?.result;
      const resultHtml = result
        ? `<div class="warning-box" style="margin-top:12px"><strong>导入完成</strong><p>写入 ${result.written || 0} 条 · 冲突 ${result.conflicts || 0} · 一致 ${result.agreements || 0} · 未匹配 ${result.unmatchedCount || 0}</p></div>`
        : '';
      return `<form class="form-grid" id="modal-form"><div class="field full"><p class="muted" style="margin:0;line-height:1.55">选择另一位 reviewer 导出的 <code>qiuzheng.screening.diff.v1</code> JSON。将按 citationId / DOI / 标题匹配，并写入 <strong>human_b</strong>；与本平台 human 不一致的记录会进入冲突裁决。</p></div><div class="field full"><label class="drop-zone" for="diff-import-file">${icon('upload', 28)}<strong>${payload.fileName ? escapeHtml(payload.fileName) : '选择 Diff JSON 文件'}</strong>${payload.error ? `<span class="muted" style="color:var(--red)">${escapeHtml(payload.error)}</span>` : ''}</label><input class="visually-hidden" id="diff-import-file" type="file" accept=".json,application/json" /></div>${resultHtml}</form>`;
    })()],
    history: ['方案版本历史', state.protocolVersions?.length ? `<div class="version-list">${state.protocolVersions.map((v) => `<div><strong>v${v.version}</strong><p>${escapeHtml(v.question || '')}</p><small>${new Date(v.createdAt).toLocaleString('zh-CN')}</small></div>`).join('')}</div>` : '<div class="empty-state"><p>暂无历史版本</p></div>'],
    report: ['报告预览', `<div class="report-preview"><span class="badge amber">草稿</span><h2>${escapeHtml(payload.title || '报告')}</h2><p>${escapeHtml(payload.description || '')}</p><div class="preview-block"><strong>数据范围</strong><p>文献 ${state.citations.length} 条，已筛 ${state.screeningCompleted} 条，审计 ${state.audits.length} 条。</p></div></div>`],
    citation: ['文献详情', (() => {
      const abstractText = payload.abstract || payload.raw?.abstract || '';
      const hasPdf = Boolean(payload.hasPdf || payload.raw?.pdfFileId);
      const hasMd = Boolean(payload.hasMd || (payload.raw?.fullTextMarkdown || '').trim());
      return `<div class="report-preview"><span class="badge blue">${escapeHtml(payload.source || '')}</span><h2>${escapeHtml(payload.title || '')}</h2><p>${escapeHtml(payload.authors || '')}</p><div class="preview-block"><strong>摘要</strong><p class="abstract-full">${abstractText ? escapeHtml(abstractText) : '无摘要'}</p></div><div class="preview-block"><strong>DOI</strong><p>${escapeHtml(payload.doi || '未提供')}</p></div><div class="preview-block"><strong>全文状态</strong><p>${escapeHtml(payload.fullText || 'Missing')}${hasPdf ? ' · PDF' : ''}${hasMd ? ' · MD' : ''}</p><p class="muted" style="font-size:12px;margin-top:8px;line-height:1.5">全文请在「全文筛选」阶段上传或删除。</p></div></div>`;
    })()],
  };

  const [title, body] = configs[state.modal] || configs.settings;
  const saveable = ['criterion', 'question', 'pico', 'concept', 'term', 'import', 'import-screening-diff', 'upload-fulltext', 'delete-fulltext', 'delete-citations', 'delete-project', 'settings', 'exclusion', 'extraction-field', 'extraction-value', 'delete-extraction-field'].includes(state.modal);
  const saveLabel = state.modal === 'import' || state.modal === 'upload-fulltext' || state.modal === 'import-screening-diff'
    ? '上传'
    : state.modal === 'delete-project' && Number(state.modalPayload?.step || 1) <= 1
      ? '继续删除'
      : state.modal === 'delete-fulltext' || state.modal === 'delete-citations' || state.modal === 'delete-extraction-field' || state.modal === 'delete-project'
        ? '确认永久删除'
        : state.modal === 'exclusion'
          ? '确认排除'
          : '保存';
  const saveClass = state.modal === 'delete-fulltext' || state.modal === 'delete-citations' || state.modal === 'delete-extraction-field' || state.modal === 'delete-project' ? 'danger-button' : 'primary-button';
  return `<div class="modal-backdrop" data-action="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><div class="modal-head"><h3 id="modal-title">${title}</h3><button class="icon-button" data-action="modal-close" aria-label="关闭">${icon('x')}</button></div><div class="modal-body">${body}</div><div class="modal-actions"><button class="ghost-button" data-action="modal-close">${saveable ? '取消' : '关闭'}</button>${saveable ? `<button class="${saveClass}" data-action="modal-save">${saveLabel}</button>` : ''}</div></div></div>`;
}
