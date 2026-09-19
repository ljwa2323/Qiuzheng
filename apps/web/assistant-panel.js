export function buildAssistantPanel({
  state,
  icon,
  escapeHtml,
  titleMap,
  currentScreenCase,
  includedForFulltext,
  currentFulltextCitation,
  screeningConflicts,
  robJudgement,
  recomputeDerivedCounts,
}) {
  recomputeDerivedCounts();

  function assistantJobLabel(status) {
    return ({ queued: '排队中', active: '进行中', completed: '已完成', failed: '失败', partial: '部分完成' })[status] || status || '';
  }

  function jobInFlight() {
    return Boolean(state.assistantJob && !['completed', 'failed'].includes(state.assistantJob.status));
  }

  function focusCitation() {
    if (state.active === 'screening') return currentScreenCase();
    if (state.active === 'fulltext') {
      if (typeof currentFulltextCitation === 'function') return currentFulltextCitation();
      return includedForFulltext()[state.fulltextIndex || 0] || includedForFulltext()[0] || null;
    }
    if (state.active === 'adjudication') return screeningConflicts()[state.adjudicationIndex || 0]?.citation || null;
    if (state.active === 'rob') return state.robCitations.find((item) => item.id === state.robCitationId) || state.robCitations[0] || null;
    if (state.active === 'extraction') {
      const focusId = state.extractionFocus?.citationId || state.modalPayload?.citationId;
      if (focusId) return state.citations.find((c) => c.id === focusId) || null;
      return null;
    }
    return null;
  }

  function resultBlock() {
    if (state.pendingQuestionDraft) {
      return `<div class="assistant-result"><header><strong>研究问题优化稿（待确认）</strong></header><p class="muted" style="font-size:11px;margin:0 0 8px">原文</p><p style="margin:0 0 10px;font-size:12px;line-height:1.55">${escapeHtml(state.question || '')}</p><p class="muted" style="font-size:11px;margin:0 0 8px">优化后</p><p style="margin:0;font-size:12px;line-height:1.55">${escapeHtml(state.pendingQuestionDraft)}</p><button class="primary-button" style="margin-top:10px" data-action="assistant-apply-question-draft">采纳写入方案</button> <button class="ghost-button" data-action="assistant-clear-suggestion">丢弃</button></div>`;
    }
    if (state.pendingSearchStrategy?.length) {
      const meshNote = state.assistantResult?.summary
        ? `<p class="muted" style="margin:0 0 8px;font-size:11px">${escapeHtml(state.assistantResult.summary)}</p>`
        : '';
      const badge = state.assistantResult?.badge
        || `${state.pendingSearchStrategy.length} 概念`;
      return `<div class="assistant-result"><header><strong>检索策略草稿（待确认）</strong><span class="badge amber">${escapeHtml(badge)}</span></header>${meshNote}${state.pendingSearchStrategy.map((c) => `<div class="assistant-strategy-block"><strong>${escapeHtml(c.title)}</strong>${(c.controlled || []).length ? `<small class="term-label">MeSH：${escapeHtml((c.controlled || []).join(' · '))}</small>` : '<small class="muted">MeSH：（未匹配）</small>'}<small>${escapeHtml((c.free || []).join(' OR ') || '（无自由词）')}</small></div>`).join('')}<button class="primary-button" style="margin-top:10px" data-action="assistant-apply-search-strategy">采纳并生成检索式</button> <button class="ghost-button" data-action="assistant-clear-suggestion">丢弃</button></div>`;
    }
    if (state.pendingMeshMap?.items?.length) {
      const meshNote = state.assistantResult?.summary
        ? `<p class="muted" style="margin:0 0 8px;font-size:11px">${escapeHtml(state.assistantResult.summary)}</p>`
        : '';
      const badge = state.assistantResult?.badge || `${state.pendingMeshMap.items.length} 概念`;
      return `<div class="assistant-result"><header><strong>MeSH 映射（待确认）</strong><span class="badge amber">${escapeHtml(badge)}</span></header>${meshNote}${state.pendingMeshMap.items.map((item) => `<div class="assistant-strategy-block"><strong>${escapeHtml(item.title || '未命名概念')}</strong><small class="muted">原受控词：${escapeHtml((item.previous || []).join(' · ') || '（空）')}</small><small class="term-label">新 MeSH：${escapeHtml((item.proposed || []).join(' · ') || '（未匹配）')}</small></div>`).join('')}<button class="primary-button" style="margin-top:10px" data-action="assistant-apply-mesh-map" ${(state.pendingMeshMap.items || []).some((i) => i.proposed?.length) ? '' : 'disabled'}>采纳并写入受控词</button> <button class="ghost-button" data-action="assistant-clear-suggestion">丢弃</button></div>`;
    }
    if (state.pendingSearchTerms?.length) {
      return `<div class="assistant-result"><header><strong>检索词建议（待确认）</strong></header><ul>${state.pendingSearchTerms.map((t) => `<li>${escapeHtml(t)}</li>`).join('')}</ul><button class="primary-button" data-action="assistant-apply-search-terms">加入当前概念</button> <button class="ghost-button" data-action="assistant-clear-suggestion">丢弃</button></div>`;
    }
    if (state.pendingProtocolCriteria?.length) {
      return `<div class="assistant-result"><header><strong>纳入排除标准草稿（待确认）</strong><span class="badge amber">${state.pendingProtocolCriteria.length} 条</span></header>${state.pendingProtocolCriteria.map((c) => `<div class="assistant-strategy-block"><strong>${escapeHtml(c.id)} · ${escapeHtml(c.title)}</strong><small>纳入：${escapeHtml((c.include || []).join('；') || '—')}</small><small>排除：${escapeHtml((c.exclude || []).join('；') || '—')}</small></div>`).join('')}<button class="primary-button" style="margin-top:10px" data-action="assistant-apply-protocol-criteria">采纳写入方案</button> <button class="ghost-button" data-action="assistant-clear-suggestion">丢弃</button></div>`;
    }
    if (state.pendingProtocolSuggestion) {
      return `<div class="assistant-result"><header><strong>方案建议（未能解析）</strong></header><pre class="assistant-pre">${escapeHtml(state.pendingProtocolSuggestion)}</pre><button class="ghost-button" data-action="assistant-clear-suggestion">丢弃</button></div>`;
    }
    if (state.assistantResult) {
      const r = state.assistantResult;
      const progress = r.progress
        ? `<div class="job-progress" aria-label="任务进度 ${r.progress.percent}%"><div class="job-progress-track"><div class="job-progress-bar ${r.progress.status === 'failed' ? 'is-failed' : r.progress.status === 'partial' ? 'is-partial' : ''}" style="width:${r.progress.percent}%"></div></div><small>${r.progress.done} / ${r.progress.total}${r.progress.succeeded != null ? ` · 成功 ${r.progress.succeeded}` : ''}${r.progress.failed ? ` · 失败 ${r.progress.failed}` : ''} · ${escapeHtml(assistantJobLabel(r.progress.status))}</small></div>`
        : '';
      const jobActions = r.jobActions?.canRetry
        ? `<div class="assistant-job-actions">${(r.jobActions.retryFailed || []).length ? `<button class="primary-button" data-action="assistant-retry-failed-batch">重试失败项（${r.jobActions.retryFailed.length}）</button>` : ''}${(r.jobActions.resumeRemaining || []).length || (r.jobActions.retryFailed || []).length ? `<button class="ghost-button" data-action="assistant-resume-batch">续跑未完成</button>` : ''}</div>`
        : '';
      return `<div class="assistant-result"><header><strong>${escapeHtml(r.title || '最近结果')}</strong>${r.badge ? `<span class="badge ${r.progress?.status === 'failed' ? 'red' : r.progress?.status === 'completed' ? 'green' : r.progress?.status === 'partial' ? 'amber' : 'purple'}">${escapeHtml(r.badge)}</span>` : ''}</header><p>${escapeHtml(r.summary || '')}</p>${progress}${jobActions}${r.evidence ? `<div class="evidence-quote">${escapeHtml(r.evidence)}</div>` : ''}</div>`;
    }
    const focus = focusCitation();
    if (state.active === 'screening' && focus?.ai) {
      return `<div class="assistant-result"><header><strong>初筛 AI</strong><span class="badge purple">${escapeHtml(focus.ai)}</span></header><p>${escapeHtml(focus.reason || '')}</p>${focus.evidence ? `<div class="evidence-quote">${escapeHtml(focus.evidence)}</div>` : ''}</div>`;
    }
    if (state.active === 'rob') {
      const ai = robJudgement(state.robQuestionKey, 'ai');
      if (ai) {
        return `<div class="assistant-result"><header><strong>${escapeHtml(state.robQuestionKey)}</strong><span class="badge purple">${escapeHtml(ai.judgement)}</span></header><p>${escapeHtml(ai.rationale || '')}</p>${ai.evidenceText ? `<div class="evidence-quote">${escapeHtml(ai.evidenceText)}</div>` : ''}</div>`;
      }
    }
    if (state.active === 'adjudication' && state.adjudicationSuggestion) {
      const s = state.adjudicationSuggestion;
      return `<div class="assistant-result"><header><strong>裁决建议（未写入）</strong><span class="badge amber">${escapeHtml(s.decision)}</span></header><p>${escapeHtml(s.rationale || '')}</p>${s.evidence ? `<div class="evidence-quote">${escapeHtml(s.evidence)}</div>` : ''}<button class="primary-button" style="margin-top:10px" data-action="assistant-adopt-adjudication">采纳建议并写入终裁</button></div>`;
    }
    return `<div class="assistant-empty"><p class="muted">运行动作后，结构化结果与原文证据会显示在这里。</p></div>`;
  }

  function actionsForModule() {
    const hasCred = Boolean(state.credentialId);
    const focus = focusCitation();
    const busy = state.assistantBusy || state.robBusy || jobInFlight();
    const needCred = !hasCred;
    const actions = [];
    const push = (id, label, disabled) => actions.push({ id, label, disabled: Boolean(disabled || busy) });

    if (state.active === 'dashboard') push('assistant-priority-summary', '生成本日优先事项摘要', needCred);
    else if (state.active === 'protocol') {
      push('assistant-optimize-question', '优化研究问题描述', needCred || !state.question);
      push('assistant-extract-pico', '从研究问题抽取 PICO', needCred || !state.question);
      push('assistant-suggest-criteria', '根据 PICO 生成纳入排除标准', needCred || !state.question || !(state.pico?.p || state.pico?.i || state.pico?.c || state.pico?.o));
    }
    else if (state.active === 'search') {
      const basis = (() => {
        const hasQuestion = Boolean(state.question?.trim());
        const hasPico = Boolean(state.pico?.p || state.pico?.i || state.pico?.c || state.pico?.o);
        const preferred = state.searchStrategyBasis || 'both';
        if (preferred === 'both' && hasQuestion && hasPico) return preferred;
        if (preferred === 'question' && hasQuestion) return preferred;
        if (preferred === 'pico' && hasPico) return preferred;
        if (hasQuestion && hasPico) return 'both';
        if (hasQuestion) return 'question';
        if (hasPico) return 'pico';
        return preferred;
      })();
      const canGenerate = basis === 'both'
        ? Boolean(state.question?.trim()) && Boolean(state.pico?.p || state.pico?.i || state.pico?.c || state.pico?.o)
        : basis === 'pico'
          ? Boolean(state.pico?.p || state.pico?.i || state.pico?.c || state.pico?.o)
          : Boolean(state.question?.trim());
      push('assistant-generate-strategy', '生成检索策略', needCred || !canGenerate);
      push('assistant-suggest-terms', '为当前概念补同义词', needCred || !state.concepts.length);
      const currentConcept = state.concepts.find((c) => c.id === state.searchConceptId) || state.concepts[0];
      const canMapCurrent = Boolean(currentConcept && (currentConcept.title || (currentConcept.free || []).length));
      push('assistant-map-mesh-current', '为当前概念映射 MeSH', !canMapCurrent || busy);
      push('assistant-map-mesh-all', '为全部概念映射 MeSH', !state.concepts.length || busy);
    }
    else if (state.active === 'library') push('assistant-library-gaps', '指出缺摘要/缺全文记录', false);
    else if (state.active === 'screening') {
      push('assistant-run-screen-ai', '对本条跑初筛 AI', needCred || !focus?.id);
      push('assistant-batch-ai', '对勾选记录批量跑 AI', needCred || !(state.selectedBatch && state.selectedBatch.length) || jobInFlight());
    } else if (state.active === 'fulltext') push('assistant-fulltext-ai', '对本条跑全文资格 AI', needCred || !focus?.id);
    else if (state.active === 'extraction') {
      push('assistant-extract-all', '一键全部提取', needCred || !state.citations.length || jobInFlight());
      push('assistant-extract-row', '对本行预填全部字段', needCred || !focus?.id);
      push('assistant-extract-cell', '对当前单元格预填', needCred || !(state.extractionFocus?.citationId || state.modalPayload?.citationId) || !(state.extractionFocus?.fieldId || state.modalPayload?.fieldId));
    } else if (state.active === 'rob') {
      push('run-rob-all', '一键评价全部纳入研究', needCred || !(state.robCitations || []).length || Boolean(state.robAllProgress));
      push('assistant-run-rob-find', 'AI 找原文（可校验）', needCred || !state.robCitationId || state.robView !== 'detail');
      push('assistant-run-rob-ai', '对当前 signaling question 跑 AI 评估', needCred || !state.robCitationId || state.robView !== 'detail');
    }
    else if (state.active === 'adjudication') {
      const conflict = screeningConflicts()[state.adjudicationIndex || 0];
      const dual = conflict?.kind === 'human_human_b';
      push('assistant-adjudication-suggest', dual ? '双人 Diff 请人工终裁（不适用 AI 建议）' : '生成裁决建议（不自动终裁）', needCred || !focus?.id || dual);
    }
    else if (state.active === 'meta') {
      push('assistant-meta-validate', '检查可计算性', !state.metaAnalysisId);
      push('assistant-meta-tools', '列出转换工具', false);
      push('assistant-meta-convert-rate', '率 → 事件数', false);
      push('assistant-meta-convert-or-ci', 'OR+CI → yi/sei', false);
      push('assistant-meta-convert-rr-ci', 'RR+CI → yi/sei', false);
      push('assistant-meta-convert-md-ci', 'MD+CI → yi/sei', false);
    }
    else if (state.active === 'synthesis') push('assistant-report-draft', '生成状态草稿段落', needCred);
    else if (state.active === 'audit') push('assistant-explain-audit', '解释最近审计事件', needCred || !state.audits.length);
    return actions;
  }

  const focus = focusCitation();
  const actions = actionsForModule();
  const credOk = Boolean(state.credentialId);
  const focusLabel = focus?.title
    ? focus.title.slice(0, 72) + (focus.title.length > 72 ? '…' : '')
    : (state.active === 'protocol' ? '当前方案' : state.active === 'search'
      ? ((state.concepts.find((c) => c.id === state.searchConceptId) || state.concepts[0])?.title || '检索概念')
      : '无焦点记录');

  const hasQuestion = Boolean(state.question?.trim());
  const hasPico = Boolean(state.pico?.p || state.pico?.i || state.pico?.c || state.pico?.o);
  const basisOptions = [
    { id: 'question', label: '研究问题', available: hasQuestion },
    { id: 'pico', label: 'PICO', available: hasPico },
    { id: 'both', label: '问题 + PICO', available: hasQuestion && hasPico },
  ];
  const activeBasis = (() => {
    const preferred = state.searchStrategyBasis || 'both';
    if (basisOptions.some((item) => item.id === preferred && item.available)) return preferred;
    return basisOptions.find((item) => item.available)?.id || preferred;
  })();
  const searchBasisBlock = state.active === 'search'
    ? `<div class="assistant-basis">
        <span class="muted">生成依据</span>
        <div class="assistant-basis-options" role="group" aria-label="检索策略生成依据">
          ${basisOptions.map((item) => `<button type="button" class="assistant-basis-option ${activeBasis === item.id ? 'active' : ''}" data-search-basis="${item.id}" ${item.available ? '' : 'disabled'} title="${item.available ? '' : (item.id === 'pico' ? '请先抽取或填写 PICO' : item.id === 'both' ? '需要同时有研究问题与 PICO' : '请先填写研究问题')}">${escapeHtml(item.label)}</button>`).join('')}
        </div>
        ${!hasQuestion && !hasPico ? '<p class="muted assistant-basis-hint">请先填写研究问题，或到方案中抽取 PICO</p>' : !hasPico ? '<p class="muted assistant-basis-hint">尚无 PICO 时仅能按研究问题生成；可到方案中抽取</p>' : !hasQuestion ? '<p class="muted assistant-basis-hint">尚无研究问题时仅能按 PICO 生成</p>' : ''}
      </div>`
    : '';

  return `<aside class="ai-panel ${state.aiOpen ? 'open' : ''}">
    <div class="ai-head"><div class="ai-title"><div class="ai-orb">${icon('spark')}</div><div><strong>Qiuzheng AI</strong><small>双入口 · 证据绑定 · ${credOk ? '凭据已配置' : '未配置凭据'}</small></div><button class="icon-button" style="margin-left:auto;width:29px;height:29px" data-action="ai-close" aria-label="关闭助手">${icon('x')}</button></div></div>
    <div class="ai-content assistant-body">
      <section class="assistant-section">
        <h4>上下文</h4>
        <div class="assistant-context">
          <div><span class="muted">模块</span><strong>${escapeHtml(titleMap[state.active] || state.active)}</strong></div>
          <div><span class="muted">焦点</span><strong title="${escapeHtml(focus?.title || '')}">${escapeHtml(focusLabel)}</strong></div>
          <div><span class="muted">方案</span><strong>${state.protocolVersion ? `v${state.protocolVersion}` : '—'}</strong></div>
          ${!credOk ? '<button class="link-button" data-action="settings">配置模型凭据</button>' : ''}
        </div>
      </section>
      <section class="assistant-section">
        <h4>动作</h4>
        ${searchBasisBlock}
        <div class="assistant-actions">${actions.length ? actions.map((a) => `<button class="soft-button assistant-action" data-action="${a.id}" ${a.disabled ? 'disabled' : ''}>${escapeHtml(a.label)}</button>`).join('') : '<p class="muted">当前模块暂无动作</p>'}${state.assistantBusy || jobInFlight() ? `<p class="muted">${jobInFlight() ? '批量任务进行中…' : '助手处理中…'}</p>` : ''}</div>
      </section>
      <section class="assistant-section">
        <h4>结果</h4>
        ${resultBlock()}
      </section>
      ${state.lastAiQuestion ? `<section class="assistant-section"><h4>追问记录</h4><div class="ai-conversation"><div class="ai-message user">${escapeHtml(state.lastAiQuestion)}</div><div class="ai-message">${escapeHtml(state.lastAiAnswer)}</div></div></section>` : ''}
    </div>
    <div class="ai-compose"><div class="compose-box"><textarea data-assistant-ask placeholder="追问当前任务（自动注入模块与文献上下文）…"></textarea><div class="compose-actions"><small>${credOk ? '带任务上下文调用模型' : '请先配置模型凭据'}</small><button class="send-button" data-action="send" ${credOk && !state.assistantBusy ? '' : 'disabled'}>${icon('send')}</button></div></div></div>
  </aside>`;
}

export function assistantFocusId(state, helpers) {
  const focus = (() => {
    if (state.active === 'screening') return helpers.currentScreenCase();
    if (state.active === 'fulltext') {
      if (typeof helpers.currentFulltextCitation === 'function') return helpers.currentFulltextCitation();
      return helpers.includedForFulltext()[state.fulltextIndex || 0] || helpers.includedForFulltext()[0];
    }
    if (state.active === 'adjudication') return helpers.screeningConflicts()[state.adjudicationIndex || 0]?.citation;
    if (state.active === 'rob') return state.robCitations.find((item) => item.id === state.robCitationId) || state.robCitations[0];
    if (state.active === 'extraction') {
      const focusId = state.extractionFocus?.citationId || state.modalPayload?.citationId;
      if (focusId) return state.citations.find((c) => c.id === focusId);
      return null;
    }
    return null;
  })();
  return focus?.id || null;
}
