/* ==========================================================================
   cart.js — carrito con AJAX ligero. Sólo se carga en /cart.

   Cambios de cantidad y eliminar línea van por fetch a /cart/change.js;
   la respuesta re-renderiza la sección entera pidiendo su HTML a Shopify
   (?sections=cart-items), así que los totales y el estado de "vacío" nunca
   se desincronizan a mano. Añadir el extra de mantenimiento usa /cart/add.js
   con el mismo patrón de re-render, e incluye `selling_plan` cuando el
   producto de mantenimiento ya tiene un plan mensual (Shopify Subscriptions)
   para que se facture como suscripción recurrente en vez de pago único.

   El popup de mantenimiento (#CartItems [data-cart-care-modal]) se muestra
   solo cuando el carrito lo incluye (main-cart.liquid decide eso) y el
   visitante no lo ha descartado ya en esta pestaña (sessionStorage).
   ========================================================================== */
(function () {
  'use strict';

  var SECTION_ID = 'main-cart';
  var CARE_DISMISSED_KEY = 'qwCareDismissed';
  var root = document.getElementById('CartItems');
  if (!root) return;

  function setBusy(busy) {
    root.classList.toggle('is-updating', busy);
  }

  function renderError(message) {
    var box = root.querySelector('[data-cart-error]');
    if (!box) return;
    box.textContent = message || window.cartStrings.error;
    box.hidden = false;
  }

  function change(line, quantity) {
    setBusy(true);
    fetch(window.routes.cart_change_url + '.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ line: line, quantity: quantity, sections: [SECTION_ID], sections_url: window.location.pathname })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.errors) {
          renderError(typeof data.errors === 'string' ? data.errors : window.cartStrings.error);
          setBusy(false);
          return;
        }
        replaceSection(data);
        updateCartCount(data.item_count);
      })
      .catch(function () {
        renderError();
        setBusy(false);
      });
  }

  function addExtra(variantId, sellingPlanId, button) {
    setBusy(true);
    var item = { id: parseInt(variantId, 10), quantity: 1 };
    if (sellingPlanId) item.selling_plan = parseInt(sellingPlanId, 10);

    fetch('/cart/add.js', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        items: [item],
        sections: [SECTION_ID],
        sections_url: window.location.pathname
      })
    })
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.errors || data.status) {
          var message = typeof data.errors === 'string' ? data.errors : window.cartStrings.error;
          var errorBox = root.querySelector('[data-cart-care-error]');
          if (errorBox) {
            errorBox.textContent = message;
            errorBox.hidden = false;
          } else {
            renderError(message);
          }
          setBusy(false);
          if (button) button.disabled = false;
          return;
        }
        replaceSection(data);
        if (typeof data.item_count === 'number') updateCartCount(data.item_count);
      })
      .catch(function () {
        renderError();
        setBusy(false);
        if (button) button.disabled = false;
      });
  }

  function replaceSection(data) {
    var html = data.sections && data.sections[SECTION_ID];
    if (!html) { setBusy(false); return; }
    var next = new DOMParser().parseFromString(html, 'text/html').getElementById('CartItems');
    if (next) {
      root.innerHTML = next.innerHTML;
      bind(root);
    }
    setBusy(false);
  }

  function updateCartCount(count) {
    document.querySelectorAll('.cart-link__count').forEach(function (el) {
      el.textContent = count;
      el.hidden = count === 0;
    });
  }

  function bindCareModal(scope) {
    var modal = scope.querySelector('[data-cart-care-modal]');
    if (!modal) return;

    var askStep = modal.querySelector('[data-cart-care-step="ask"]');
    var plansStep = modal.querySelector('[data-cart-care-step="plans"]');

    function open() {
      modal.setAttribute('aria-hidden', 'false');
    }
    function close(remember) {
      modal.setAttribute('aria-hidden', 'true');
      if (remember) {
        try { sessionStorage.setItem(CARE_DISMISSED_KEY, '1'); } catch (e) {}
      }
    }

    modal.querySelectorAll('[data-cart-care-dismiss]').forEach(function (btn) {
      btn.addEventListener('click', function () { close(true); });
    });
    modal.querySelector('[data-cart-care-yes]')?.addEventListener('click', function () {
      if (askStep) askStep.hidden = true;
      if (plansStep) plansStep.hidden = false;
    });

    var alreadyDismissed = false;
    try { alreadyDismissed = sessionStorage.getItem(CARE_DISMISSED_KEY) === '1'; } catch (e) {}
    if (!alreadyDismissed) open();
  }

  function bind(scope) {
    scope.querySelectorAll('[data-qty-decrease]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = btn.parentElement.querySelector('[data-qty-input]');
        var next = Math.max(0, parseInt(input.value, 10) - 1);
        change(btn.dataset.line, next);
      });
    });
    scope.querySelectorAll('[data-qty-increase]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var input = btn.parentElement.querySelector('[data-qty-input]');
        var next = parseInt(input.value, 10) + 1;
        change(btn.dataset.line, next);
      });
    });
    scope.querySelectorAll('[data-qty-input]').forEach(function (input) {
      input.addEventListener('change', function () {
        var next = Math.max(0, parseInt(input.value, 10) || 0);
        change(input.dataset.line, next);
      });
    });
    scope.querySelectorAll('[data-line-remove]').forEach(function (btn) {
      btn.addEventListener('click', function () { change(btn.dataset.line, 0); });
    });
    scope.querySelectorAll('[data-cart-add-extra]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.disabled = true;
        addExtra(btn.dataset.cartAddExtra, btn.dataset.sellingPlan, btn);
      });
    });

    bindCareModal(scope);
  }

  bind(root);
})();
