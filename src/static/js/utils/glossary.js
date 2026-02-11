const DEFAULT_TERM_STYLE = 'background:none;border:none;color:inherit;font:inherit;font-weight:inherit;cursor:pointer;text-decoration:underline dotted;text-underline-offset:2px;padding:0;';

function toDataAttributeName(camelName) {
    return camelName.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * Render a clickable glossary term.
 */
export function glossaryTerm(label, key, options = {}) {
    const className = options.className || 'glossary-term';
    const attrName = options.attrName || 'glossaryTerm';
    const attrDataName = toDataAttributeName(attrName);
    const title = options.title || 'Click for definition';
    const style = options.style || DEFAULT_TERM_STYLE;

    return `<button type="button" class="${className}" data-${attrDataName}="${key}" style="${style}" title="${title}">${label}</button>`;
}

/**
 * Open a standard glossary definition modal.
 */
export function showGlossaryDefinition(glossary, key) {
    const item = glossary?.[key];
    if (!item) return;

    const closeId = `close-glossary-definition-${Math.random().toString(36).slice(2, 10)}`;
    const modal = document.createElement('div');
    modal.innerHTML = `
        <div style="position: fixed; inset: 0; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10001; padding: 20px;">
            <div style="background: var(--bg-primary); border-radius: 12px; padding: 20px; max-width: 540px; width: 100%; border: 2px solid var(--accent-color);">
                <h3 style="margin: 0 0 10px 0; color: var(--accent-color);">${item.title}</h3>
                <p style="margin: 0; line-height: 1.6; color: var(--text-primary);">${item.definition}</p>
                <div style="margin-top: 16px; text-align: right;">
                    <button id="${closeId}" style="padding: 8px 16px; background: var(--accent-color); color: var(--text-on-accent); border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">Close</button>
                </div>
            </div>
        </div>
    `;

    document.body.appendChild(modal);
    modal.querySelector(`#${closeId}`)?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
}

/**
 * Wire click handlers for glossary terms within a container.
 */
export function wireGlossaryTermClicks(root, glossary, options = {}) {
    if (!root) return;

    const className = options.className || 'glossary-term';
    const attrName = options.attrName || 'glossaryTerm';
    const selector = `.${className}`;

    root.querySelectorAll(selector).forEach((el) => {
        el.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const key = el.dataset[attrName];
            showGlossaryDefinition(glossary, key);
        });
    });
}
