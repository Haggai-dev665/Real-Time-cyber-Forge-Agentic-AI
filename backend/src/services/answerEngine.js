/**
 * Which engine produced an assistant's answer, said the same way everywhere
 * (F28, decision in plan section 15).
 *
 * An answer can come from the open-source model inside the ML service, from a
 * hosted model the server is configured to use, from the ML service's or the
 * backend's fixed texts when no model answered, or (on the desktop) directly
 * from DeepSeek with the user's own token. Each answer carries one of these
 * descriptions, worked out from what the answering side said about itself,
 * never from what the product would like the answer to have come from.
 *
 *   { id, kind: 'language-model' | 'fixed-text', where, model, label }
 */

const ENGINES = {
  spaceModel: model => ({
    id: 'ml-service-model',
    kind: 'language-model',
    where: 'CyberForge Analysis Agents',
    model: model || 'open-source model',
    label: `${shortName(model) || 'Open-source model'} (open-source, in the CyberForge Analysis Agents)`
  }),
  spaceRules: () => ({
    id: 'ml-service-rules',
    kind: 'fixed-text',
    where: 'CyberForge Analysis Agents',
    model: null,
    label: 'Rule-based summary from the Analysis Agents: no language model answered'
  }),
  // The model was asked and did not finish (busy, out of time, no text). The
  // answer says so instead of offering a summary in its place.
  noAnswer: () => ({
    id: 'ml-service-no-answer',
    kind: 'fixed-text',
    where: 'CyberForge Analysis Agents',
    model: null,
    label: 'No answer: the Analysis Agents\'s language model did not finish'
  }),
  knowledgeBase: () => ({
    id: 'backend-knowledge-base',
    kind: 'fixed-text',
    where: 'CyberForge server',
    model: null,
    label: 'Built-in reference text: no language model answered'
  }),
  template: () => ({
    id: 'backend-template',
    kind: 'fixed-text',
    where: 'CyberForge server',
    model: null,
    label: 'Template text: no language model answered'
  }),
  hosted: (provider, model) => ({
    id: `hosted-${provider}`,
    kind: 'language-model',
    where: `${provider === 'gemini' ? 'Google' : provider}, configured on the server`,
    model,
    label: `${model} (hosted by ${provider === 'gemini' ? 'Google' : provider}, configured on the server)`
  }),
  unknown: () => ({ id: 'unknown', kind: 'unknown', where: null, model: null, label: 'Agent not reported' })
};

/** "unsloth/Qwen3.5-2B-GGUF" → "Qwen3.5-2B" */
function shortName(model) {
  if (!model) return '';
  return String(model).split('/').pop().replace(/-GGUF$/i, '');
}

/** The engine of an answer from the ML service's chat route, from what that answer says about itself. */
function engineOfSpaceAnswer(answer) {
  if (!answer || typeof answer !== 'object') return ENGINES.unknown();
  if (answer.model_used === 'cyberforge-ml-fallback') return ENGINES.spaceRules();
  if (answer.source === 'space_local_llamacpp' || answer.model === 'local-llm') return ENGINES.spaceModel(answer.model_id);
  if (answer.model === 'cyberforge-kb') return ENGINES.knowledgeBase();
  return ENGINES.unknown();
}

module.exports = { ENGINES, engineOfSpaceAnswer, shortName };
