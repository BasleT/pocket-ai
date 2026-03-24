export const FEATURE_TOGGLES_STORAGE_KEY = 'settings.featureToggles';
export const PRIVATE_MODE_STORAGE_KEY = 'settings.privateMode';

export type FeatureToggleId =
  | 'chatPanel'
  | 'summarizePanel'
  | 'youtubePanel'
  | 'pdfPanel'
  | 'ocrPanel'
  | 'selectionToolbar'
  | 'pageContextAutoRead'
  | 'youtubeAutoFetch'
  | 'ocrScreenshotFallback'
  | 'carryContext';

export type FeatureToggles = Record<FeatureToggleId, boolean>;

export const DEFAULT_FEATURE_TOGGLES: FeatureToggles = {
  chatPanel: true,
  summarizePanel: true,
  youtubePanel: false,
  pdfPanel: true,
  ocrPanel: true,
  selectionToolbar: true,
  pageContextAutoRead: true,
  youtubeAutoFetch: false,
  ocrScreenshotFallback: true,
  carryContext: false,
};

const PRIVATE_MODE_LOCKED_TOGGLES: FeatureToggleId[] = [
  'selectionToolbar',
  'pageContextAutoRead',
  'youtubeAutoFetch',
  'ocrScreenshotFallback',
  'carryContext',
];

export function normalizeFeatureToggles(
  toggles: Partial<FeatureToggles> | undefined,
): FeatureToggles {
  return {
    ...DEFAULT_FEATURE_TOGGLES,
    ...(toggles ?? {}),
  };
}

export function isToggleLockedByPrivateMode(toggleId: FeatureToggleId, privateMode: boolean): boolean {
  return privateMode && PRIVATE_MODE_LOCKED_TOGGLES.includes(toggleId);
}

export function getEffectiveFeatureToggles(
  toggles: Partial<FeatureToggles> | undefined,
  privateMode: boolean,
): FeatureToggles {
  const normalized = normalizeFeatureToggles(toggles);
  if (!privateMode) {
    return normalized;
  }

  const next = { ...normalized };
  for (const toggleId of PRIVATE_MODE_LOCKED_TOGGLES) {
    next[toggleId] = false;
  }

  return next;
}
