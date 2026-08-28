/**
 * Il movimento del sito, senza librerie.
 *
 * Regole: solo transform e opacity, nessun listener scroll sincrono,
 * tutto spento se la persona chiede meno animazioni. Se il JS non
 * arriva, la pagina è comunque completa: .pronto si aggiunge qui,
 * quindi senza JS niente resta invisibile.
 */
(function () {
	'use strict';

	var riduci = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	// Rivelazioni allo scroll.
	//
	// L'observer fa il caso bello (l'elemento entra scorrendo); il controllo
	// su scroll copre quello brutto: un salto di àncora o il tasto Fine
	// scavalcano gli elementi senza mai intersecarli, e senza questa rete
	// resterebbero invisibili.
	if (!riduci && 'IntersectionObserver' in window) {
		document.documentElement.classList.add('pronto');
		var daRivelare = Array.prototype.slice.call(document.querySelectorAll('.rivela'));

		var rivela = function (el) {
			el.classList.add('in-vista');
			var i = daRivelare.indexOf(el);
			if (i > -1) daRivelare.splice(i, 1);
			oss.unobserve(el);
		};

		var oss = new IntersectionObserver(function (voci) {
			voci.forEach(function (v) {
				if (v.isIntersecting) rivela(v.target);
			});
		}, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
		daRivelare.forEach(function (el) { oss.observe(el); });

		var inCoda = false;
		var recupera = function () {
			inCoda = false;
			for (var i = daRivelare.length - 1; i >= 0; i--) {
				if (daRivelare[i].getBoundingClientRect().top < window.innerHeight) {
					rivela(daRivelare[i]);
				}
			}
			if (!daRivelare.length) window.removeEventListener('scroll', suScroll);
		};
		var suScroll = function () {
			if (!inCoda) { inCoda = true; requestAnimationFrame(recupera); }
		};
		window.addEventListener('scroll', suScroll, { passive: true });
	}

	// Barra di avanzamento della galleria orizzontale.
	document.querySelectorAll('.scorri').forEach(function (scorri) {
		var barra = scorri.parentElement.querySelector('.scorri-indice');
		if (!barra) return;
		var aggiorna = function () {
			var max = scorri.scrollWidth - scorri.clientWidth;
			var quota = max > 0 ? scorri.scrollLeft / max : 0;
			var larghezza = Math.max(0.18, scorri.clientWidth / scorri.scrollWidth);
			barra.style.width = (larghezza * 100) + '%';
			barra.style.transform = 'translateX(' + (quota * (100 / larghezza - 100)) + '%)';
		};
		scorri.addEventListener('scroll', function () { requestAnimationFrame(aggiorna); }, { passive: true });
		aggiorna();
	});

	// Menu mobile.
	var apri = document.querySelector('.apri-menu');
	var menu = document.getElementById('menu-mobile');
	if (apri && menu) {
		apri.addEventListener('click', function () {
			var aperto = menu.hasAttribute('data-aperto');
			if (aperto) {
				menu.removeAttribute('data-aperto');
				menu.hidden = true;
			} else {
				menu.setAttribute('data-aperto', '');
				menu.hidden = false;
			}
			apri.setAttribute('aria-expanded', String(!aperto));
		});
	}
})();
