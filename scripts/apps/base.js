const { ApplicationV2 } = foundry.applications.api;

/**
 * Minimal ApplicationV2 that renders an HTML string from `_body(context)`.
 * Keeps the module free of template files while still using the v13 application framework
 * (window chrome, dragging, actions via data-action, forms).
 */
export class HGApplication extends ApplicationV2 {
  static DEFAULT_OPTIONS = {
    classes: ["hg-app"],
    window: { resizable: true },
    position: { height: "auto" }
  };

  /** @abstract */
  _body(_context) {
    return "";
  }

  async _renderHTML(context, _options) {
    const t = document.createElement("template");
    t.innerHTML = this._body(context);
    return t.content;
  }

  _replaceHTML(result, content, _options) {
    content.replaceChildren(result);
  }
}
