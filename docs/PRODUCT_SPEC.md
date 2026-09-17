# Qiuzheng 初版产品说明

## 1. 产品定位

Qiuzheng 是系统综述研究的统一工作环境。科学问题不是大语言模型能否替代研究人员，而是人和大语言模型在证据综合各环节应该如何分工、何时独立判断、何时升级、何时相互纠错。

平台的核心目标同时包含：

- 维持或提高方法学质量
- 降低可避免的人工工作量
- 控制高后果错误
- 减少自动化偏倚
- 保留完整可复核记录

## 2. 通用交互模型

每个任务都可以使用以下一种或多种模式：

1. AI 执行，人工按风险抽查
2. 人工与 AI 独立判断，发生分歧后裁决
3. 人工决策，AI 检查并提出挑战
4. 规则系统执行确定性计算

升级到人工处理的条件不只依赖模型置信度，还包括：

- 证据不足
- 标准含义模糊
- 多项标准相互冲突
- 既往高错误率标准
- 错误后果较高
- 方案发生修改

## 3. 页面结构

### 项目总览

展示综述全流程、关键数量、待处理任务和近期活动。用户进入项目后应立即知道当天需要处理的内容。

### 研究问题与方案

维护结构化研究问题和带唯一 ID 的纳入排除标准。方案修改后自动创建版本，并识别受影响的历史判断。

### 检索策略

先维护数据库无关的概念、受控词、自由词和逻辑关系，再编译到 PubMed、Embase、Web of Science、CENTRAL 等语法。使用哨兵文献和 PRESS 项目进行验证。

### 文献管理

导入 RIS、BibTeX、CSV、PubMed XML。执行去重、元数据合并与全文关联，同时保留数据库来源、检索批次和重复关系。

### 题目摘要筛选

支持单篇盲法、AI 辅助和批量筛选。核心输出包含 Decision、Evidence、Criterion、Uncertainty、Action。排除时必须绑定标准 ID。

### 全文筛选

PDF 阅读器与标准面板并排。AI 为每项标准定位原文证据，信息不足时明确标记未报告，不做推断。

### 数据提取

采用电子表格式工作区。每个单元格绑定原文、页码、提取方式、置信程度和人工核验状态，并识别正文、表格、流程图和附录之间的冲突。

### 偏倚风险

逐领域和逐 signaling question 完成判断。人工与 AI 可独立评价，分歧进入裁决中心。

### 冲突裁决

并排展示 Reviewer A、Reviewer B 与 AI 的判断、理由和证据。裁决者基于最新方案做最终判断，平台记录推翻、挽救和错误采纳情况。

### 证据综合与报告

生成 PRISMA 流程图、检索附录、排除全文清单、研究特征、偏倚风险结果、Meta-analysis 输入和人机协作统计。

### 审计记录

记录操作者、时间、前后内容、模型版本、提示词版本、方案版本、检索版本和批量任务 ID。

## 4. 建议的核心数据实体

- User
- Team
- ReviewProject
- ProtocolVersion
- EligibilityCriterion
- SearchConcept
- SearchTerm
- SearchVersion
- ImportBatch
- Citation
- CitationSource
- FullTextDocument
- ScreeningDecision
- EvidenceSpan
- ExtractionSchema
- ExtractedValue
- RiskOfBiasAssessment
- AdjudicationCase
- AuditEvent
- ModelRun

## 5. 研究指标

除敏感度、特异度、准确率、F1、时间与工作量外，平台应原生记录：

- Human override rate
- AI rescue rate
- Disagreement resolution accuracy
- Automation error adoption rate
- Human review proportion
- Calibration
- Criterion-specific error rate
- Evidence verification rate

## 6. 初版边界

当前提交完成交互式界面和信息架构，不包含生产后端。所有数字均为示例，不能用于研究结论。真实部署还需身份鉴权、权限隔离、数据持久化、文件存储、模型服务、异步任务、日志治理和安全评估。
