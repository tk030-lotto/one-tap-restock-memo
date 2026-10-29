/**
 * js/state.js
 * 項目の追加・重複判定・1タップ状態遷移・履歴カウント更新・ソート・Undo管理を担当するモジュール
 */

import { cloneState, saveState } from './storage.js';

export const MAX_ITEM_LENGTH = 50;
export const MAX_HISTORY_CHIPS = 8;

/**
 * 一意なIDを生成する
 * @returns {string}
 */
function generateId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `item-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * 入力文字列を正規化する（前後空白除去・最大50文字）
 * @param {string} rawInput
 * @returns {string}
 */
export function normalizeName(rawInput) {
  if (typeof rawInput !== 'string') return '';
  return rawInput.replace(/^[\s\u3000]+|[\s\u3000]+$/g, '').slice(0, MAX_ITEM_LENGTH);
}

/**
 * 履歴配列内の該当項目を更新（存在すればuseCount+1、なければ新規追加）する
 * @param {Array} history
 * @param {string} name
 * @param {number} now
 */
function incrementHistory(history, name, now) {
  const existing = history.find((h) => h.name === name);
  if (existing) {
    existing.useCount += 1;
    existing.lastUsedAt = now;
  } else {
    history.push({
      name,
      useCount: 1,
      lastUsedAt: now
    });
  }
}

/**
 * 項目を「要補充」として追加または再有効化する（入力欄および履歴チップから呼ばれた場合のみuseCountを加算）
 * @param {Object} state 現在のAppState
 * @param {string} rawName 入力またはタップされた項目名
 * @returns {{ status: 'empty' | 'duplicate_active' | 'reactivated' | 'added', targetItem?: Object, previousState?: Object, message?: string }}
 */
export function addItemOrRestock(state, rawName) {
  const name = normalizeName(rawName);
  if (!name) {
    return { status: 'empty' };
  }

  const now = Date.now();
  const existingItem = state.items.find((it) => it.name === name);

  // 1. すでに「要補充（未完了）」に同名項目が存在する場合は重複追加せずハイライト対象として返す
  if (existingItem && !existingItem.isCompleted) {
    return {
      status: 'duplicate_active',
      targetItem: existingItem,
      message: `「${name}」はすでに要補充リストにあります`
    };
  }

  const previousState = cloneState(state);

  // 2. 「補充済み（完了）」に同名項目が存在する場合は「要補充」へ戻し、履歴カウントを加算する
  if (existingItem && existingItem.isCompleted) {
    existingItem.isCompleted = false;
    existingItem.createdAt = now;
    delete existingItem.completedAt;
    incrementHistory(state.history, name, now);
    saveState(state);
    return {
      status: 'reactivated',
      targetItem: existingItem,
      previousState,
      message: `「${name}」を要補充に追加しました`
    };
  }

  // 3. 新規項目として追加
  const newItem = {
    id: generateId(),
    name,
    isCompleted: false,
    createdAt: now
  };
  state.items.unshift(newItem);
  incrementHistory(state.history, name, now);
  saveState(state);

  return {
    status: 'added',
    targetItem: newItem,
    previousState,
    message: `「${name}」を要補充に追加しました`
  };
}

/**
 * 項目の完了状態（要補充 ⇄ 補充済み）を1タップで切り替える
 * ※補充済みリストからの「要補充に戻す」トグル操作では履歴のuseCountを加算しない（誤操作復帰でカウントが膨らむのを防ぐ）
 * @param {Object} state
 * @param {string} itemId
 * @returns {{ changed: boolean, item?: Object, previousState?: Object, message?: string }}
 */
export function toggleItemCompleted(state, itemId) {
  const item = state.items.find((it) => it.id === itemId);
  if (!item) {
    return { changed: false };
  }

  const previousState = cloneState(state);
  const now = Date.now();

  if (!item.isCompleted) {
    // 要補充 → 補充済み
    item.isCompleted = true;
    item.completedAt = now;
    saveState(state);
    return {
      changed: true,
      item,
      previousState,
      message: `「${item.name}」を補充済みにしました`
    };
  } else {
    // 補充済み → 要補充に戻す（useCountは加算しない）
    item.isCompleted = false;
    item.createdAt = now;
    delete item.completedAt;
    saveState(state);
    return {
      changed: true,
      item,
      previousState,
      message: `「${item.name}」を要補充に戻しました`
    };
  }
}

/**
 * 指定IDの項目を個別削除する（履歴は維持）
 * @param {Object} state
 * @param {string} itemId
 * @returns {{ deleted: boolean, previousState?: Object, message?: string }}
 */
export function deleteItemById(state, itemId) {
  const index = state.items.findIndex((it) => it.id === itemId);
  if (index === -1) {
    return { deleted: false };
  }

  const previousState = cloneState(state);
  const [removed] = state.items.splice(index, 1);
  saveState(state);

  return {
    deleted: true,
    previousState,
    message: `「${removed.name}」を削除しました`
  };
}

/**
 * 補充済み（完了）の項目を一括削除する
 * @param {Object} state
 * @returns {{ clearedCount: number, previousState?: Object, message?: string }}
 */
export function clearCompletedItems(state) {
  const completedCount = state.items.filter((it) => it.isCompleted).length;
  if (completedCount === 0) {
    return { clearedCount: 0 };
  }

  const previousState = cloneState(state);
  state.items = state.items.filter((it) => !it.isCompleted);
  saveState(state);

  return {
    clearedCount: completedCount,
    previousState,
    message: `補充済みの項目（${completedCount}件）をクリアしました`
  };
}

/**
 * Undoスナップショットまたは他タブ同期データから状態を置換する
 * @param {Object} state
 * @param {Object} nextState
 * @param {boolean} persist localStorageへ書き戻すかどうか
 */
export function replaceState(state, nextState, persist = true) {
  if (!nextState) return false;
  state.version = nextState.version;
  state.items = nextState.items.map((it) => ({ ...it }));
  state.history = nextState.history.map((h) => ({ ...h }));
  if (persist) {
    saveState(state);
  }
  return true;
}

/**
 * Undoスナップショットから状態を復元する
 * @param {Object} state
 * @param {Object} snapshot
 */
export function restoreStateFromSnapshot(state, snapshot) {
  return replaceState(state, snapshot, true);
}

/**
 * 画面表示用にソートされた「要補充リスト」「よく使う項目チップ」「補充済みリスト」を取得する
 * @param {Object} state
 * @returns {{ activeItems: Array, suggestedChips: Array, completedItems: Array }}
 */
export function getSortedViewData(state) {
  const activeItems = state.items
    .filter((it) => !it.isCompleted)
    .sort((a, b) => b.createdAt - a.createdAt);

  const completedItems = state.items
    .filter((it) => it.isCompleted)
    .sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));

  const activeNames = new Set(activeItems.map((it) => it.name));

  // 現在「要補充」に入っていない履歴項目を利用回数順 → 最終利用日時順で最大8件抽出
  const suggestedChips = state.history
    .filter((h) => !activeNames.has(h.name))
    .sort((a, b) => {
      if (b.useCount !== a.useCount) {
        return b.useCount - a.useCount;
      }
      return (b.lastUsedAt || 0) - (a.lastUsedAt || 0);
    })
    .slice(0, MAX_HISTORY_CHIPS);

  return {
    activeItems,
    suggestedChips,
    completedItems
  };
}
