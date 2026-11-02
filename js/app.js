/**
 * js/app.js
 * アプリケーションのエントリーポイント。イベントリスナー登録、複数タブ同期、Undoタイマー制御、Service Worker登録を行う
 */

import { STORAGE_KEY, loadState } from './storage.js';
import {
  addItemOrRestock,
  toggleItemCompleted,
  deleteItemById,
  clearCompletedItems,
  replaceState,
  restoreStateFromSnapshot
} from './state.js';
import {
  renderApp,
  highlightExistingItem,
  showToastUI,
  hideToastUI
} from './ui.js';

const UNDO_TIMEOUT_MS = 3500;

document.addEventListener('DOMContentLoaded', () => {
  const elements = {
    activeCountBadge: document.getElementById('active-count-badge'),
    activeList: document.getElementById('active-list'),
    emptyActiveState: document.getElementById('empty-active-state'),
    historySection: document.getElementById('history-section'),
    historyChipsContainer: document.getElementById('history-chips'),
    completedSection: document.getElementById('completed-section'),
    completedCountLabel: document.getElementById('completed-count'),
    completedList: document.getElementById('completed-list'),
    clearCompletedBtn: document.getElementById('clear-completed-btn'),
    addForm: document.getElementById('add-form'),
    itemInput: document.getElementById('item-input'),
    toastContainer: document.getElementById('undo-toast'),
    toastMessage: document.getElementById('undo-message'),
    undoButton: document.getElementById('undo-btn'),
    storageWarning: document.getElementById('storage-warning')
  };

  const { state, storageAvailable } = loadState();
  if (!storageAvailable && elements.storageWarning) {
    elements.storageWarning.hidden = false;
  }

  const SAVE_FAILED_MESSAGE = '保存できませんでした。ブラウザの保存領域が使えないため、この画面を閉じるとデータは失われます。';

  /**
   * 保存に失敗したときは、既存の警告バナーを表示し、トーストの文言を失敗に差し替える (I-1)
   * @param {Object} result state.js の戻り値
   * @param {string} fallback 成功時の文言
   * @returns {string}
   */
  function messageFor(result, fallback) {
    if (result && result.persisted === false) {
      if (elements.storageWarning) elements.storageWarning.hidden = false;
      return SAVE_FAILED_MESSAGE;
    }
    return fallback || (result && result.message) || '';
  }

  let undoSnapshot = null;
  let undoTimerId = null;

  /**
   * トースト通知とUndoスナップショットをセットし、3.5秒タイマーを開始する
   * @param {string} message
   * @param {Object|null} snapshot
   */
  function triggerToast(message, snapshot = null) {
    if (undoTimerId) {
      clearTimeout(undoTimerId);
      undoTimerId = null;
    }
    undoSnapshot = snapshot;
    showToastUI(elements, message, Boolean(snapshot));

    undoTimerId = window.setTimeout(() => {
      undoSnapshot = null;
      undoTimerId = null;
      hideToastUI(elements);
    }, UNDO_TIMEOUT_MS);
  }

  // 初期描画
  renderApp(state, elements);

  // 1. 下部入力フォームからの項目追加
  elements.addForm.addEventListener('submit', (event) => {
    event.preventDefault();
    const rawValue = elements.itemInput.value;
    const result = addItemOrRestock(state, rawValue);

    if (result.status === 'empty') {
      elements.itemInput.value = '';
      return;
    }

    elements.itemInput.value = '';
    renderApp(state, elements);

    if (result.status === 'duplicate_active' && result.targetItem) {
      highlightExistingItem(result.targetItem.id, elements.activeList);
      triggerToast(result.message, null);
    } else if (result.previousState) {
      triggerToast(messageFor(result, result.message), result.previousState);
    }
  });

  // 2. 要補充リスト内のイベント委譲（補充完了 / 削除）
  elements.activeList.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const itemId = btn.dataset.id;

    if (action === 'toggle') {
      const res = toggleItemCompleted(state, itemId);
      if (res.changed) {
        renderApp(state, elements);
        triggerToast(messageFor(res, res.message), res.previousState);
      }
    } else if (action === 'delete') {
      const res = deleteItemById(state, itemId);
      if (res.deleted) {
        renderApp(state, elements);
        triggerToast(messageFor(res, res.message), res.previousState);
      }
    }
  });

  // 3. よく使う項目チップ（履歴）からの1タップ追加
  elements.historyChipsContainer.addEventListener('click', (event) => {
    const chip = event.target.closest('button[data-action="quick-add"]');
    if (!chip) return;

    const itemName = chip.dataset.name;
    const result = addItemOrRestock(state, itemName);
    renderApp(state, elements);

    if (result.previousState) {
      triggerToast(messageFor(result, result.message), result.previousState);
    }
  });

  // 4. 補充済みリスト内のイベント委譲（要補充へ戻す / 削除）
  elements.completedList.addEventListener('click', (event) => {
    const btn = event.target.closest('button[data-action]');
    if (!btn) return;

    const action = btn.dataset.action;
    const itemId = btn.dataset.id;

    if (action === 'toggle') {
      const res = toggleItemCompleted(state, itemId);
      if (res.changed) {
        renderApp(state, elements);
        triggerToast(messageFor(res, res.message), res.previousState);
      }
    } else if (action === 'delete') {
      const res = deleteItemById(state, itemId);
      if (res.deleted) {
        renderApp(state, elements);
        triggerToast(messageFor(res, res.message), res.previousState);
      }
    }
  });

  // 5. 補充済み項目のクリア（一括削除）
  elements.clearCompletedBtn.addEventListener('click', () => {
    const res = clearCompletedItems(state);
    if (res.clearedCount > 0) {
      renderApp(state, elements);
      triggerToast(messageFor(res, res.message), res.previousState);
    }
  });

  // 6. Undo（元に戻す）ボタン
  elements.undoButton.addEventListener('click', () => {
    if (!undoSnapshot) return;
    if (undoTimerId) {
      clearTimeout(undoTimerId);
      undoTimerId = null;
    }
    const restored = restoreStateFromSnapshot(state, undoSnapshot);
    undoSnapshot = null;
    if (restored && restored.persisted === false && elements.storageWarning) {
      elements.storageWarning.hidden = false;
    }
    hideToastUI(elements);
    renderApp(state, elements);
  });

  // 7. 複数タブ間の状態同期（別タブでlocalStorageが更新された際にメモリ上のstateを最新化する）
  window.addEventListener('storage', (event) => {
    if (event.key !== STORAGE_KEY) return;
    const latest = loadState();
    replaceState(state, latest.state, false);
    if (undoTimerId) {
      clearTimeout(undoTimerId);
      undoTimerId = null;
    }
    undoSnapshot = null;
    hideToastUI(elements);
    renderApp(state, elements);
  });

  // 8. Service Worker 登録（HTTP/HTTPS環境のみ）
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost' || location.hostname === '127.0.0.1')) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./sw.js').catch((err) => {
        console.warn('Service Workerの登録をスキップしました:', err);
      });
    });
  }
});
