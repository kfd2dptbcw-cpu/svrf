/*!
 * SVRF Surf Forecast embed loader.
 *
 * Usage:
 *   <div data-surf-forecast="/embed/cornwall/fistral"></div>
 *   <script src="https://YOUR-FORECAST-DOMAIN/embed.js" async></script>
 *
 * Replaces each placeholder with an auto-resizing iframe.
 */
(function () {
  var script = document.currentScript;
  var origin = script ? new URL(script.src).origin : window.location.origin;
  var frames = [];

  function mount(el) {
    if (el.getAttribute("data-surf-mounted")) return;
    el.setAttribute("data-surf-mounted", "1");
    var path = el.getAttribute("data-surf-forecast") || "/embed";
    var iframe = document.createElement("iframe");
    iframe.src = origin + (path.charAt(0) === "/" ? path : "/" + path);
    iframe.title = el.getAttribute("data-title") || "Surf forecast";
    iframe.loading = "lazy";
    iframe.style.width = "100%";
    iframe.style.border = "0";
    iframe.style.height = (el.getAttribute("data-height") || "360") + "px";
    iframe.style.colorScheme = "normal";
    el.appendChild(iframe);
    frames.push(iframe);
  }

  window.addEventListener("message", function (event) {
    if (event.origin !== origin || !event.data || event.data.type !== "uk-surf-forecast:resize") return;
    for (var i = 0; i < frames.length; i++) {
      if (frames[i].contentWindow === event.source) frames[i].style.height = Math.ceil(event.data.height) + "px";
    }
  });

  var nodes = document.querySelectorAll("[data-surf-forecast]");
  for (var i = 0; i < nodes.length; i++) mount(nodes[i]);
})();
