/**
 * js/storage.js
 * ローカルストレージへの状態保存・読み込み・データ検証・初期プリセット定義を担当するモジュール
 */

export const STORAGE_KEY = 'consumable_restock_state';
export const SCHEMA_VERSION = 1;

export const DEFAULT_HISTORY = [
  { name: 'トイレットペーパー', useCount: 1, lastUsedAt: 0 },
  { name: 'ティッシュ', useCount: 1, lastUsedAt: 0 },
  { name: '食器用洗剤', useCount: 1, lastUsedAt: 0 },
  { name: 'ゴミ袋', useCount: 1, lastUsedAt: 0 },
  { name: '乾電池', useCount: 1, lastUsedAt: 0 }
];

/**
 * 初期状態オブジェクトを生成して返す（初回起動時は要補充リストは空、履歴候補5件のみ設定）
 * @returns {Object} AppState
 */
export function createInitialState() {
  return {
    version: SCHEMA_VERSION,
    items: [],
    history: DEFAULT_HISTORY.map((item) => ({ ...item }))
  };
}

/**
 * 状態のディープコピーを作成する（Undoスナップショット用）
 * @param {Object} state
 * @returns {Object}
 */
export function cloneState(state) {
  return {
    version: state.version || SCHEMA_VERSION,
    items: Array.isArray(state.items)
      ? state.items.map((item) => ({ ...item }))
      : [],
    history: Array.isArray(state.history)
      ? state.history.map((h) => ({ ...h }))
      : []
  };
}

/**
 * 読み込んだデータの構造を検証・正規化する
 * @param {any} raw
 * @returns {Object} 正規化されたAppState
 */
export function validateAndNormalizeState(raw) {
  if (!raw || typeof raw !== 'object') {
    return createInitialState();
  }

  const items = Array.isArray(raw.items)
    ? raw.items
        .filter((it) => it && typeof it.name === 'string' && it.name.trim().length > 0)
        .map((it) => ({
          id: typeof it.id === 'string' && it.id ? it.id : `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: it.name.trim().slice(0, 50),
          isCompleted: Boolean(it.isCompleted),
          createdAt: Number.isFinite(it.createdAt) ? it.createdAt : Date.now(),
          ...(Number.isFinite(it.completedAt) ? { completedAt: it.completedAt } : {})
        }))
    : [];

  const history = Array.isArray(raw.history) && raw.history.length > 0
    ? raw.history
        .filter((h) => h && typeof h.name === 'string' && h.name.trim().length > 0)
        .map((h) => ({
          name: h.name.trim().slice(0, 50),
          useCount: Number.isFinite(h.useCount) && h.useCount > 0 ? h.useCount : 1,
          lastUsedAt: Number.isFinite(h.lastUsedAt) ? h.lastUsedAt : 0
        }))
    : DEFAULT_HISTORY.map((item) => ({ ...item }));

  return {
    version: SCHEMA_VERSION,
    items,
    history
  };
}

/**
 * localStorageから状態を読み込む。失敗・破損時は安全な初期状態を返す
 * @returns {{ state: Object, storageAvailable: boolean }}
 */
export function loadState() {
  try {
    const serialized = window.localStorage.getItem(STORAGE_KEY);
    if (!serialized) {
      const initial = createInitialState();
      saveState(initial);
      return { state: initial, storageAvailable: true };
    }
    const parsed = JSON.parse(serialized);
    return {
      state: validateAndNormalizeState(parsed),
      storageAvailable: true
    };
  } catch (err) {
    console.warn('localStorageの読み込みに失敗したため初期状態で起動します:', err);
    return {
      state: createInitialState(),
      storageAvailable: false
    };
  }
}

/**
 * localStorageへ状態を保存する。失敗時も例外を投げずfalseを返す
 * @param {Object} state
 * @returns {boolean} 保存成功可否
 */
export function saveState(state) {
  try {
    const serialized = JSON.stringify(state);
    window.localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (err) {
    console.warn('localStorageへの保存に失敗しました（メモリ上で動作を継続します）:', err);
    return false;
  }
}
