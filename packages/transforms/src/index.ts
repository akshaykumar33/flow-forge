export { diffModels, structuralChanges, type Change, type ElementKind } from './diff.js';
export {
  applySuggestion,
  runTransform,
  type Suggestion,
  type Transform,
  type TransformOutput,
  type TransformResult,
} from './transform.js';
export {
  canRedo,
  canUndo,
  createHistory,
  currentModel,
  record,
  redo,
  revert,
  undo,
  type History,
  type HistoryEntry,
} from './history.js';
export {
  namingTransform,
  ORIGINAL_LABEL_KEY,
  type LabelCase,
  type NamingProfile,
} from './naming.js';
export { tidyLabelsTransform } from './tidy-labels.js';
