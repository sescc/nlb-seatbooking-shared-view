// Minimal fake DOM for the push-client tests. It deliberately REJECTS what NLB's CSP forbids
// (style attributes, <style>/<script> elements, innerHTML), so a passing test proves CSSOM-only styling.
export class FakeElement {
  style: Record<string, string> = {};
  children: FakeElement[] = [];
  attrs: Record<string, string> = {};
  parent: FakeElement | null = null;
  textContent = '';
  onclick: (() => void) | null = null;
  id = '';
  method = '';
  action = '';
  target = '';
  type = '';
  name = '';
  value = '';
  removed = false;

  constructor(readonly tagName: string, private readonly doc: FakeDocument) {}

  // The `acceptCharset` property reflects the accept-charset attribute.
  set acceptCharset(v: string) {
    this.attrs['accept-charset'] = v;
  }
  get acceptCharset(): string {
    return this.attrs['accept-charset'] ?? '';
  }

  setAttribute(k: string, v: string): void {
    if (k.toLowerCase() === 'style') throw new Error('CSP: style attribute is blocked');
    this.attrs[k] = v;
  }
  set innerHTML(_v: string) {
    throw new Error('innerHTML is not allowed');
  }
  appendChild(c: FakeElement): FakeElement {
    c.parent = this;
    this.children.push(c);
    return c;
  }
  remove(): void {
    this.removed = true;
    if (this.parent) this.parent.children = this.parent.children.filter((c) => c !== this);
  }
  submit(): void {
    this.doc.submissions.push({
      action: this.action,
      method: this.method,
      target: this.target,
      attrs: { ...this.attrs },
      hidden: this.style.display === 'none',
      fields: Object.fromEntries(this.children.filter((c) => c.tagName === 'input').map((c) => [c.name, c.value])),
    });
  }
  all(): FakeElement[] {
    return [this, ...this.children.flatMap((c) => c.all())];
  }
}

export interface Submission {
  action: string;
  method: string;
  target: string;
  attrs: Record<string, string>;
  hidden: boolean;
  fields: Record<string, string>;
}

export class FakeDocument {
  body = new FakeElement('body', this);
  submissions: Submission[] = [];
  created: string[] = [];
  nodes: Record<string, unknown> = {};

  createElement(tag: string): FakeElement {
    const t = tag.toLowerCase();
    if (t === 'style' || t === 'script') throw new Error(`CSP: <${t}> elements are blocked`);
    this.created.push(t);
    return new FakeElement(t, this);
  }
  getElementById(id: string): FakeElement | null {
    return this.body.all().find((e) => e.id === id) ?? null;
  }
  querySelector(sel: string): unknown {
    return this.nodes[sel] ?? null;
  }
  asDocument(): Document {
    return this as unknown as Document;
  }
  // All text currently shown in the page (not yet removed).
  visibleText(): string {
    return this.body
      .all()
      .map((e) => e.textContent)
      .join('|');
  }
}
