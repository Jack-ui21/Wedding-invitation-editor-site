declare module "jsdom" {
  export class JSDOM {
    constructor(html?: string, options?: Record<string, unknown>);
    window: {
      DOMParser: typeof DOMParser;
      document: Document;
    };
  }
}
