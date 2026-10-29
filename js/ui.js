/**
 * js/ui.js
 * DOMの描画・更新、よく使う項目チップの生成、重複時のハイライト演出、Undoトースト表示を担当するモジュール
 */

import { getSortedViewData } from './state.js';

/**
 * HTMLエスケープ処理
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * 消耗品行（<li>要素）を安全なDOM APIで生成する
 * @param {Object} item
 * @param {boolean} isActive
 * @returns {HTMLLIElement}
 */
function createItemRow(item, isActive) {
  const li = document.createElement('li');
  li.className = `item-row ${isActive ? 'item-active' : 'item-completed'}`;
  li.dataset.itemId = item.id;

  // メイン操作ボタン（トグル）
  const mainBtn = document.createElement('button');
  mainBtn.type = 'button';
  mainBtn.className = 'action-main-btn';
  mainBtn.dataset.action = 'toggle';
  mainBtn.dataset.id = item.id;
  mainBtn.setAttribute('role', 'checkbox');
  mainBtn.setAttribute('aria-checked', isActive ? 'false' : 'true');
  mainBtn.setAttribute('aria-label', `${item.name}${isActive ? 'を補充済みにする' : 'を要補充に戻す'}`);

  const pill = document.createElement('span');
  pill.className = `status-pill ${isActive ? 'status-pill-active' : 'status-pill-completed'}`;
  pill.textContent = isActive ? '補充する' : '✓ 補充済';

  const nameSpan = document.createElement('span');
  nameSpan.className = `item-name ${isActive ? '' : 'item-name-completed'}`.trim();
  nameSpan.textContent = item.name;

  mainBtn.appendChild(pill);
  mainBtn.appendChild(nameSpan);

  // 削除ボタン
  const delBtn = document.createElement('button');
  delBtn.type = 'button';
  delBtn.className = 'delete-item-btn';
  delBtn.dataset.action = 'delete';
  delBtn.dataset.id = item.id;
  delBtn.setAttribute('aria-label', `${item.name}を削除`);
  delBtn.title = '削除';
  delBtn.textContent = '✕';

  li.appendChild(mainBtn);
  li.appendChild(delBtn);

  return li;
}

/**
 * よく使う項目チップ（<button>要素）を安全なDOM APIで生成する
 * @param {Object} chip
 * @returns {HTMLButtonElement}
 */
function createHistoryChip(chip) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'history-chip';
  btn.dataset.action = 'quick-add';
  btn.dataset.name = chip.name;
  btn.setAttribute('aria-label', `${chip.name}を要補充リストに追加`);

  const plusSpan = document.createElement('span');
  plusSpan.className = 'chip-plus';
  plusSpan.setAttribute('aria-hidden', 'true');
  plusSpan.textContent = '＋';

  const labelSpan = document.createElement('span');
  labelSpan.className = 'chip-label';
  labelSpan.textContent = chip.name;

  btn.appendChild(plusSpan);
  btn.appendChild(labelSpan);

  return btn;
}

/**
 * アプリ全体のDOMを再描画する（安全なDOM APIとDocumentFragmentによる多層防御）
 * @param {Object} state
 * @param {Object} elements DOM要素参照オブジェクト
 */
export function renderApp(state, elements) {
  const { activeItems, suggestedChips, completedItems } = getSortedViewData(state);

  // 1. ヘッダーの要補充バッジ更新
  elements.activeCountBadge.textContent = `要補充: ${activeItems.length}件`;
  elements.activeCountBadge.classList.toggle('badge-empty', activeItems.length === 0);

  // 2. 要補充リスト（未完了）の描画
  elements.activeList.textContent = '';
  if (activeItems.length === 0) {
    elements.emptyActiveState.hidden = false;
  } else {
    elements.emptyActiveState.hidden = true;
    const fragment = document.createDocumentFragment();
    for (const item of activeItems) {
      fragment.appendChild(createItemRow(item, true));
    }
    elements.activeList.appendChild(fragment);
  }

  // 3. よく使う項目チップ（履歴）の描画
  elements.historyChipsContainer.textContent = '';
  if (suggestedChips.length === 0) {
    elements.historySection.hidden = true;
  } else {
    elements.historySection.hidden = false;
    const fragment = document.createDocumentFragment();
    for (const chip of suggestedChips) {
      fragment.appendChild(createHistoryChip(chip));
    }
    elements.historyChipsContainer.appendChild(fragment);
  }

  // 4. 補充済みリスト（完了）の描画
  elements.completedList.textContent = '';
  if (completedItems.length === 0) {
    elements.completedSection.hidden = true;
  } else {
    elements.completedSection.hidden = false;
    elements.completedCountLabel.textContent = `（${completedItems.length}）`;
    const fragment = document.createDocumentFragment();
    for (const item of completedItems) {
      fragment.appendChild(createItemRow(item, false));
    }
    elements.completedList.appendChild(fragment);
  }
}

/**
 * 既存の要補充項目をハイライトしてスクロールする（重複入力時）
 * @param {string} itemId
 * @param {HTMLElement} listElement
 */
export function highlightExistingItem(itemId, listElement) {
  const row = listElement.querySelector(`[data-item-id="${CSS.escape(itemId)}"]`);
  if (!row) return;
  row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  row.classList.remove('item-highlight');
  void row.offsetWidth;
  row.classList.add('item-highlight');
}

/**
 * Undoトースト（または通知メッセージ）を表示する
 * @param {Object} elements
 * @param {string} message
 * @param {boolean} canUndo
 */
export function showToastUI(elements, message, canUndo = true) {
  elements.toastMessage.textContent = message;
  elements.undoButton.hidden = !canUndo;
  elements.toastContainer.hidden = false;
  elements.toastContainer.classList.add('toast-visible');
}

/**
 * Undoトーストを非表示にする
 * @param {Object} elements
 */
export function hideToastUI(elements) {
  elements.toastContainer.classList.remove('toast-visible');
  elements.toastContainer.hidden = true;
}
