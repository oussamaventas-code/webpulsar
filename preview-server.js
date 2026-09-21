import express from 'express';
import { Liquid } from 'liquidjs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = __dirname;
const assetsDir = path.join(rootDir, 'assets');
const snippetsDir = path.join(rootDir, 'snippets');
const sectionsDir = path.join(rootDir, 'sections');
const layoutDir = path.join(rootDir, 'layout');
const templatesDir = path.join(rootDir, 'templates');
const localesDir = path.join(rootDir, 'locales');
const configDir = path.join(rootDir, 'config');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Helper to read and clean JSON with comments
function readJsonFile(filePath) {
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  const cleaned = content.replace(/\/\*[\s\S]*?\*\//g, '').trim();
  return JSON.parse(cleaned);
}

// Load configurations
const settingsData = readJsonFile(path.join(configDir, 'settings_data.json')) || { current: {} };
const locales = readJsonFile(path.join(localesDir, 'es.default.json')) || {};

// Initialize Liquid engine
const engine = new Liquid({
  root: [snippetsDir, sectionsDir, layoutDir],
  extname: '.liquid',
  cache: false,
  strictFilters: false,
  strictVariables: false
});

// Translation lookup
function getTranslation(key, args) {
  if (!key) return '';
  const parts = key.split('.');
  let curr = locales;
  for (const part of parts) {
    if (!curr || typeof curr !== 'object') return key;
    curr = curr[part];
  }
  if (typeof curr !== 'string') return key;
  let str = curr;
  if (args) {
    for (const [k, v] of Object.entries(args)) {
      str = str.replace(new RegExp(`{{\\s*${k}\\s*}}`, 'g'), v);
    }
  }
  return str;
}

// Shopify Liquid Filters
engine.registerFilter('default', function(val, defaultValue) {
  if (val === undefined || val === null || val === '' || val === 0) {
    return defaultValue;
  }
  return val;
});

engine.registerFilter('t', function(key, args) {
  return getTranslation(key, args);
});

engine.registerFilter('asset_url', function(filename) {
  return `/assets/${filename}`;
});

engine.registerFilter('stylesheet_tag', function(url) {
  return `<link rel="stylesheet" type="text/css" media="all" href="${url}">`;
});

engine.registerFilter('script_tag', function(url) {
  return `<script src="${url}"></script>`;
});

engine.registerFilter('image_url', function(input) {
  if (!input) return '';
  if (typeof input === 'string') {
    if (input.startsWith('http://') || input.startsWith('https://')) return input;
    return `/assets/${input}`;
  }
  if (typeof input === 'object' && input.src) return input.src;
  return '';
});

engine.registerFilter('image_tag', function(src, attrs = {}) {
  let out = `<img src="${src}"`;
  for (const [k, v] of Object.entries(attrs)) {
    out += ` ${k}="${String(v).replace(/"/g, '&quot;')}"`;
  }
  out += ` />`;
  return out;
});

engine.registerFilter('money', function(val) {
  if (val === null || val === undefined) return '';
  const num = typeof val === 'number' ? val / 100 : parseFloat(val);
  return `${num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
});

engine.registerFilter('money_without_currency', function(val) {
  if (val === null || val === undefined) return '';
  const num = typeof val === 'number' ? val / 100 : parseFloat(val);
  return `${num.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
});

engine.registerFilter('money_without_trailing_zeros', function(val) {
  if (val === null || val === undefined) return '';
  const num = typeof val === 'number' ? val / 100 : parseFloat(val);
  return `${num.toLocaleString('es-ES', { maximumFractionDigits: 2 })} €`;
});

engine.registerFilter('handle', function(str) {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
});

engine.registerFilter('handleize', function(str) {
  if (!str) return '';
  return String(str).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
});

engine.registerFilter('json', function(val) {
  return JSON.stringify(val);
});

engine.registerFilter('newline_to_br', function(val) {
  if (!val) return '';
  return String(val).replace(/\r?\n/g, '<br />\n');
});

engine.registerFilter('strip_html', function(val) {
  if (!val) return '';
  return String(val).replace(/<[^>]*>/g, '');
});

engine.registerFilter('weight_with_unit', function(val) {
  return `${val} kg`;
});

// Shopify Liquid Tags
engine.registerTag('style', {
  parse(tagToken, remainTokens) {
    this.tokens = [];
    while (remainTokens.length) {
      const token = remainTokens.shift();
      if (token.name === 'endstyle') break;
      this.tokens.push(token);
    }
  },
  * render(ctx, emitter) {
    emitter.write('<style>');
    const stream = this.liquid.parser.parseTokens(this.tokens);
    yield this.liquid.renderer.renderTemplates(stream, ctx, emitter);
    emitter.write('</style>');
  }
});

engine.registerTag('schema', {
  parse(tagToken, remainTokens) {
    while (remainTokens.length) {
      const token = remainTokens.shift();
      if (token.name === 'endschema') break;
    }
  },
  * render() {}
});

engine.registerTag('form', {
  parse(tagToken, remainTokens) {
    this.args = tagToken.args;
    this.tokens = [];
    while (remainTokens.length) {
      const token = remainTokens.shift();
      if (token.name === 'endform') break;
      this.tokens.push(token);
    }
  },
  * render(ctx, emitter) {
    const args = this.args.trim();
    let formType = 'form';
    const typeMatch = args.match(/^['"]([^'"]+)['"]/);
    if (typeMatch) formType = typeMatch[1];
    
    let clsMatch = args.match(/class:\s*['"]([^'"]+)['"]/);
    let idMatch = args.match(/id:\s*['"]([^'"]+)['"]/);
    let cls = clsMatch ? ` class="${clsMatch[1]}"` : '';
    let id = idMatch ? ` id="${idMatch[1]}"` : '';

    emitter.write(`<form method="post" action="#"${id}${cls} data-form="${formType}">`);
    emitter.write(`<input type="hidden" name="form_type" value="${formType}">`);
    const stream = this.liquid.parser.parseTokens(this.tokens);
    yield this.liquid.renderer.renderTemplates(stream, ctx, emitter);
    emitter.write('</form>');
  }
});

engine.registerTag('javascript', {
  parse(tagToken, remainTokens) {
    this.tokens = [];
    while (remainTokens.length) {
      const token = remainTokens.shift();
      if (token.name === 'endjavascript') break;
      this.tokens.push(token);
    }
  },
  * render(ctx, emitter) {
    emitter.write('<script>');
    const stream = this.liquid.parser.parseTokens(this.tokens);
    yield this.liquid.renderer.renderTemplates(stream, ctx, emitter);
    emitter.write('</script>');
  }
});

engine.registerTag('stylesheet', {
  parse(tagToken, remainTokens) {
    this.tokens = [];
    while (remainTokens.length) {
      const token = remainTokens.shift();
      if (token.name === 'endstylesheet') break;
      this.tokens.push(token);
    }
  },
  * render(ctx, emitter) {
    emitter.write('<style>');
    const stream = this.liquid.parser.parseTokens(this.tokens);
    yield this.liquid.renderer.renderTemplates(stream, ctx, emitter);
    emitter.write('</style>');
  }
});

// Render individual section
async function renderSection(sectionId, sectionDef, globalContext) {
  const sectionType = sectionDef.type;
  const filePath = path.join(sectionsDir, `${sectionType}.liquid`);
  if (!fs.existsSync(filePath)) {
    return `<!-- Section ${sectionType} not found -->`;
  }

  const blockOrder = sectionDef.block_order || Object.keys(sectionDef.blocks || {});
  const blocks = blockOrder.map(bId => {
    const b = (sectionDef.blocks && sectionDef.blocks[bId]) || {};
    return {
      id: bId,
      type: b.type,
      settings: b.settings || {},
      shopify_attributes: `data-shopify-block="${bId}"`
    };
  });

  const sectionObj = {
    id: sectionId,
    settings: sectionDef.settings || {},
    blocks: blocks,
    shopify_attributes: `data-shopify-section="${sectionId}"`
  };

  const sectionCtx = {
    ...globalContext,
    section: sectionObj,
    forloop: undefined
  };

  const fileContent = fs.readFileSync(filePath, 'utf-8');
  const rendered = await engine.parseAndRender(fileContent, sectionCtx);
  return `<div id="shopify-section-${sectionId}" class="shopify-section">${rendered}</div>`;
}

// sections tag (group rendering)
engine.registerTag('sections', {
  parse(tagToken) {
    this.groupName = tagToken.args.trim().replace(/^['"]|['"]$/g, '');
  },
  async render(ctx, emitter) {
    const groupFile = path.join(sectionsDir, `${this.groupName}.json`);
    if (!fs.existsSync(groupFile)) return;
    const groupDef = readJsonFile(groupFile);
    if (!groupDef) return;
    
    let output = '';
    const order = groupDef.order || Object.keys(groupDef.sections || {});
    const globalContext = ctx.getAll();
    for (const secId of order) {
      const secDef = groupDef.sections[secId];
      if (secDef) {
        output += await renderSection(secId, secDef, globalContext);
      }
    }
    emitter.write(output);
  }
});

// section tag (single section)
engine.registerTag('section', {
  parse(tagToken) {
    this.secName = tagToken.args.trim().replace(/^['"]|['"]$/g, '');
  },
  async render(ctx, emitter) {
    const globalContext = ctx.getAll();
    const output = await renderSection(this.secName, { type: this.secName, settings: {} }, globalContext);
    emitter.write(output);
  }
});

// Build base Shopify global context
function buildGlobalContext(req, templateName = 'index', templateSuffix = '') {
  const origin = `${req.protocol}://${req.get('host')}`;
  return {
    shop: {
      name: "WebPulsar",
      description: "Webs profesionales para negocios locales, desde 49 €.",
      domain: "webpulsar.es",
      url: origin,
      currency: "EUR",
      enabled_currencies: [{ iso_code: "EUR", name: "Euro", symbol: "€" }],
      enabled_locales: [{ iso_code: "es", name: "Español", primary: true }],
      published_locales: [{ iso_code: "es", name: "Español" }],
      enabled_payment_types: ["visa", "master", "apple_pay", "google_pay"],
      money_format: "{{amount}} €",
      money_with_currency_format: "{{amount}} € EUR"
    },
    request: {
      locale: { iso_code: "es", name: "Español" },
      origin: origin,
      path: req.path,
      host: req.get('host')
    },
    routes: {
      root_url: "/",
      account_url: "/account",
      account_login_url: "/account/login",
      account_logout_url: "/account/logout",
      account_register_url: "/account/register",
      account_addresses_url: "/account/addresses",
      collections_url: "/collections",
      all_products_collection_url: "/collections/all",
      search_url: "/search",
      cart_url: "/cart",
      cart_add_url: "/cart/add.js",
      cart_change_url: "/cart/change.js",
      cart_clear_url: "/cart/clear.js",
      cart_update_url: "/cart/update.js"
    },
    settings: settingsData.current || {},
    linklists: {
      "main-menu": {
        links: [
          { title: "Inicio", url: "/", current: req.path === '/', child_active: false },
          { title: "Planes", url: "/#planes", current: false, child_active: false },
          { title: "Ejemplos", url: "/#demos", current: false, child_active: false },
          { title: "Proceso", url: "/#proceso", current: false, child_active: false },
          { title: "FAQ", url: "/#faq", current: false, child_active: false }
        ]
      },
      "footer": {
        links: [
          { title: "Planes", url: "/#planes" },
          { title: "Mantenimiento", url: "/#mantenimiento" },
          { title: "Demos", url: "/#demos" },
          { title: "Preguntas frecuentes", url: "/#faq" }
        ]
      },
      "legal": {
        links: [
          { title: "Aviso Legal", url: "#" },
          { title: "Política de Privacidad", url: "#" },
          { title: "Política de Cookies", url: "#" },
          { title: "Términos y Condiciones", url: "#" }
        ]
      }
    },
    cart: {
      item_count: 0,
      total_price: 0,
      items: [],
      currency: { iso_code: "EUR", symbol: "€" }
    },
    template: { name: templateName, suffix: templateSuffix },
    canonical_url: `${origin}${req.originalUrl}`,
    page_title: "WebPulsar – Tu negocio merece una web desde 49 €",
    page_description: "Te ayudamos a tener una presencia online profesional, adaptada a móvil y preparada para que tus clientes te encuentren y contacten contigo.",
    content_for_header: `<script>window.Shopify = { shop: "webpulsar.es", locale: "es", currency: { active: "EUR", rate: "1.0" }, designMode: false };</script>`
  };
}

// Render page helper
async function renderPageFromTemplate(req, res, templateFile, templateName = 'index', templateSuffix = '') {
  try {
    const templatePath = path.join(templatesDir, templateFile);
    if (!fs.existsSync(templatePath)) {
      return res.status(404).send(`Template ${templateFile} not found`);
    }

    const templateDef = readJsonFile(templatePath);
    const globalContext = buildGlobalContext(req, templateName, templateSuffix);

    let contentForLayout = '';
    if (templateDef && templateDef.sections) {
      const order = templateDef.order || Object.keys(templateDef.sections || {});
      for (const secId of order) {
        const secDef = templateDef.sections[secId];
        if (secDef) {
          contentForLayout += await renderSection(secId, secDef, globalContext);
        }
      }
    }

    const themeLiquidPath = path.join(layoutDir, 'theme.liquid');
    const themeLiquidContent = fs.readFileSync(themeLiquidPath, 'utf-8');

    const finalHtml = await engine.parseAndRender(themeLiquidContent, {
      ...globalContext,
      content_for_layout: contentForLayout
    });

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.send(finalHtml);
  } catch (err) {
    console.error('Render Error:', err);
    res.status(500).send(`<pre>${err.stack}</pre>`);
  }
}

// Serve static assets
app.use('/assets', express.static(assetsDir));

// Cart API mock endpoints
app.get('/cart.js', (req, res) => {
  res.json({
    token: 'local-mock-token',
    note: null,
    attributes: {},
    total_price: 0,
    total_weight: 0,
    item_count: 0,
    items: [],
    requires_shipping: false,
    currency: 'EUR'
  });
});

app.post('/cart/add.js', (req, res) => {
  res.json({
    id: req.body.id || 64575079678321,
    quantity: req.body.quantity || 1,
    title: "Web Profesional",
    price: 4900,
    final_price: 4900,
    line_price: 4900,
    sku: "WEB-STARTER",
    image: null
  });
});

app.post(['/cart/change.js', '/cart/update.js', '/cart/clear.js'], (req, res) => {
  res.json({
    token: 'local-mock-token',
    item_count: 0,
    items: [],
    total_price: 0
  });
});

// Routes
app.get('/', (req, res) => {
  renderPageFromTemplate(req, res, 'index.json', 'index', '');
});

app.get('/cart', (req, res) => {
  renderPageFromTemplate(req, res, 'cart.json', 'cart', '');
});

app.get('/pages/:handle', (req, res) => {
  const handle = req.params.handle;
  const specificFile = `page.${handle}.json`;
  if (fs.existsSync(path.join(templatesDir, specificFile))) {
    return renderPageFromTemplate(req, res, specificFile, 'page', handle);
  }
  if (fs.existsSync(path.join(templatesDir, 'page.json'))) {
    return renderPageFromTemplate(req, res, 'page.json', 'page', handle);
  }
  res.status(404).send('Página no encontrada');
});

app.get('/products/:handle', (req, res) => {
  renderPageFromTemplate(req, res, 'product.json', 'product', req.params.handle);
});

// Catch-all 404
app.use((req, res) => {
  if (fs.existsSync(path.join(templatesDir, '404.json'))) {
    renderPageFromTemplate(req, res, '404.json', '404', '');
  } else {
    res.status(404).send('404 Not Found');
  }
});

// Start Server
app.listen(PORT, () => {
  console.log('====================================================');
  console.log(`🚀 Servidor WebPulsar activo en: http://localhost:${PORT}`);
  console.log('====================================================');
  console.log('Rutas principales:');
  console.log(`  - Inicio:        http://localhost:${PORT}/`);
  console.log(`  - Planes:        http://localhost:${PORT}/#planes`);
  console.log(`  - Carrito:       http://localhost:${PORT}/cart`);
  console.log(`  - Página Webs:   http://localhost:${PORT}/pages/webs`);
  console.log(`  - FAQ:           http://localhost:${PORT}/pages/faq`);
  console.log('====================================================');
});
