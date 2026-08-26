/* ==========================================================================
   AWeblo — interactions
   Vanilla JS, no dependencies. Every block guards against missing nodes.
   ========================================================================== */
(function () {
  "use strict";

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var $ = function (sel, ctx) { return (ctx || document).querySelector(sel); };
  var $$ = function (sel, ctx) { return Array.prototype.slice.call((ctx || document).querySelectorAll(sel)); };

  /* ---- Sticky header ---------------------------------------------------- */
  var header = $(".site-header");
  if (header) {
    var onScroll = function () {
      header.classList.toggle("is-stuck", window.scrollY > 24);
      var toTop = $(".to-top");
      if (toTop) toTop.classList.toggle("is-visible", window.scrollY > 700);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---- Mobile navigation ------------------------------------------------ */
  var toggle = $(".nav-toggle");
  var drawer = $(".mobile-nav");
  if (toggle && drawer) {
    $$("a", drawer).forEach(function (link, i) {
      link.style.transitionDelay = 0.06 * i + 0.05 + "s";
    });

    var setDrawer = function (open) {
      toggle.setAttribute("aria-expanded", String(open));
      drawer.classList.toggle("is-open", open);
      document.body.style.overflow = open ? "hidden" : "";
    };

    toggle.addEventListener("click", function () {
      setDrawer(toggle.getAttribute("aria-expanded") !== "true");
    });
    drawer.addEventListener("click", function (e) {
      if (e.target.closest("a")) setDrawer(false);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && drawer.classList.contains("is-open")) {
        setDrawer(false);
        toggle.focus();
      }
    });
    window.addEventListener("resize", function () {
      if (window.innerWidth > 960 && drawer.classList.contains("is-open")) setDrawer(false);
    });
  }

  /* ---- Scroll reveal ----------------------------------------------------
     A rAF-throttled sweep rather than IntersectionObserver: an observer can
     miss elements that are skipped over during a fast scroll or an anchor
     jump, which would leave whole sections invisible. The pending list
     shrinks as elements reveal, so this costs nothing once the page settles.
     ---------------------------------------------------------------------- */
  var revealables = $$("[data-reveal]");
  if (revealables.length) {
    if (reduceMotion) {
      revealables.forEach(function (el) { el.classList.add("is-in"); });
    } else {
      var pending = revealables.slice();

      pending.forEach(function (el) {
        var stagger = el.getAttribute("data-reveal");
        if (stagger) el.style.setProperty("--delay", parseFloat(stagger) * 0.09 + "s");
      });

      var ticking = false;
      var sweep = function () {
        ticking = false;
        var limit = window.innerHeight * 0.9;
        for (var i = pending.length - 1; i >= 0; i--) {
          if (pending[i].getBoundingClientRect().top < limit) {
            pending[i].classList.add("is-in");
            pending.splice(i, 1);
          }
        }
        if (!pending.length) {
          window.removeEventListener("scroll", requestSweep);
          window.removeEventListener("resize", requestSweep);
        }
      };
      var requestSweep = function () {
        if (ticking) return;
        ticking = true;
        window.requestAnimationFrame(sweep);
      };

      window.addEventListener("scroll", requestSweep, { passive: true });
      window.addEventListener("resize", requestSweep);
      window.addEventListener("load", requestSweep);
      sweep();
    }
  }

  /* ---- Active section in nav -------------------------------------------- */
  var navLinks = $$(".nav a[href^='#']");
  var sections = navLinks
    .map(function (link) { return document.getElementById(link.getAttribute("href").slice(1)); })
    .filter(Boolean);

  if (sections.length && "IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          link.classList.toggle("is-active", link.getAttribute("href") === "#" + entry.target.id);
        });
      });
    }, { rootMargin: "-45% 0px -50% 0px" });
    sections.forEach(function (section) { spy.observe(section); });
  }

  /* ---- Pointer sheen on cards ------------------------------------------- */
  if (!reduceMotion && window.matchMedia("(hover: hover)").matches) {
    $$(".card").forEach(function (card) {
      card.addEventListener("pointermove", function (e) {
        var rect = card.getBoundingClientRect();
        card.style.setProperty("--mx", ((e.clientX - rect.left) / rect.width) * 100 + "%");
        card.style.setProperty("--my", ((e.clientY - rect.top) / rect.height) * 100 + "%");
      });
    });
  }

  /* ---- FAQ: one open at a time ------------------------------------------ */
  var faqItems = $$(".faq__item");
  faqItems.forEach(function (item) {
    item.addEventListener("toggle", function () {
      if (!item.open) return;
      faqItems.forEach(function (other) { if (other !== item) other.open = false; });
    });
  });

  /* ---- Back to top ------------------------------------------------------ */
  var toTopBtn = $(".to-top");
  if (toTopBtn) {
    toTopBtn.addEventListener("click", function () {
      window.scrollTo({ top: 0, behavior: reduceMotion ? "auto" : "smooth" });
    });
  }

  /* ---- Footer year ------------------------------------------------------ */
  var year = $("[data-year]");
  if (year) year.textContent = new Date().getFullYear();

  /* ---- Contact form ------------------------------------------------------
     By default the form opens a pre-filled email (works with zero setup).
     To collect submissions in a dashboard instead, put a Formspree (or
     similar) endpoint in the form's `data-endpoint` attribute in index.html.
     ---------------------------------------------------------------------- */
  var form = $("#quote-form");
  if (form) {
    var status = $(".form__status", form);
    var submitBtn = $("button[type='submit']", form);

    var showError = function (field, message) {
      var wrap = field.closest(".field");
      if (!wrap) return;
      wrap.classList.add("has-error");
      var slot = $(".field__error", wrap);
      if (slot) slot.textContent = message;
    };

    var clearError = function (field) {
      var wrap = field.closest(".field");
      if (wrap) wrap.classList.remove("has-error");
    };

    $$("input, select, textarea", form).forEach(function (field) {
      field.addEventListener("input", function () { clearError(field); });
      field.addEventListener("change", function () { clearError(field); });
    });

    var validate = function () {
      var ok = true;
      var required = $$("[required]", form);

      required.forEach(function (field) {
        var value = (field.value || "").trim();
        if (!value) {
          showError(field, "This field is required.");
          ok = false;
          return;
        }
        if (field.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)) {
          showError(field, "Enter a valid email address.");
          ok = false;
        }
      });

      if (!ok) {
        var firstBad = $(".field.has-error input, .field.has-error select, .field.has-error textarea", form);
        if (firstBad) firstBad.focus();
      }
      return ok;
    };

    var announce = function (message) {
      if (!status) return;
      var text = $("span", status);
      if (text) text.textContent = message;
      status.classList.add("is-visible");
    };

    var buildMailto = function (data) {
      var lines = [
        "Name: " + data.name,
        "Email: " + data.email,
        "Phone: " + (data.phone || "—"),
        "Project type: " + data.project,
        "Budget: " + data.budget,
        "",
        "Details:",
        data.message
      ].join("\n");

      return "mailto:" + form.dataset.email +
        "?subject=" + encodeURIComponent("New project inquiry — " + data.name) +
        "&body=" + encodeURIComponent(lines);
    };

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (!validate()) return;

      var raw = new FormData(form);
      var data = {};
      raw.forEach(function (value, key) { data[key] = typeof value === "string" ? value.trim() : value; });

      var endpoint = form.dataset.endpoint;

      if (endpoint) {
        if (submitBtn) { submitBtn.disabled = true; submitBtn.dataset.label = submitBtn.textContent; submitBtn.textContent = "Sending…"; }
        fetch(endpoint, { method: "POST", body: raw, headers: { Accept: "application/json" } })
          .then(function (res) {
            if (!res.ok) throw new Error("Request failed");
            form.reset();
            announce("Thanks " + data.name.split(" ")[0] + " — your inquiry is in. Expect a reply within one business day.");
          })
          .catch(function () {
            window.location.href = buildMailto(data);
            announce("Opening your email app so nothing gets lost. You can also text 302-353-6328.");
          })
          .finally(function () {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = submitBtn.dataset.label || "Send project details"; }
          });
        return;
      }

      window.location.href = buildMailto(data);
      announce("Your email app is opening with the details filled in — just hit send. Prefer texting? 302-353-6328.");
    });
  }
})();
