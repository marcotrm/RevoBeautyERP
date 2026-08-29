/**
 * Quel poco di JavaScript che serve davvero.
 *
 * Le rivelazioni allo scorrimento non sono più qui: le fa il CSS con le
 * timeline di scorrimento, che girano sul thread di composizione e non
 * possono lasciare contenuto invisibile se qualcosa non parte. Qui restano
 * solo le due cose che il CSS non sa fare da solo: aprire il menu del
 * telefono e dire a che punto è la fila orizzontale dei trattamenti.
 */
(function () {
	'use strict';

	/*
	 * Il menu del telefono.
	 *
	 * Copre lo schermo, quindi mentre è aperto la pagina sotto non deve
	 * scorrere: un dito che scorre sul pannello e trova la pagina che si
	 * muove dietro è la cosa che fa sembrare un sito fatto male. Si chiude
	 * con Esc, toccando una voce, e col tasto che nel frattempo è diventato
	 * una croce — perché aprire e chiudere devono essere lo stesso gesto.
	 */
	var apri = document.querySelector('.apri-menu');
	var menu = document.getElementById('menu-mobile');
	if (apri && menu) {
		var cambia = function (aprire) {
			if (aprire) {
				menu.hidden = false;
				menu.setAttribute('data-aperto', '');
				document.body.setAttribute('data-menu-aperto', '');
			} else {
				menu.removeAttribute('data-aperto');
				menu.hidden = true;
				document.body.removeAttribute('data-menu-aperto');
			}
			apri.setAttribute('aria-expanded', String(aprire));
		};

		apri.addEventListener('click', function () {
			cambia(!menu.hasAttribute('data-aperto'));
		});

		menu.addEventListener('click', function (e) {
			if (e.target.closest('a')) cambia(false);
		});

		document.addEventListener('keydown', function (e) {
			if (e.key === 'Escape' && menu.hasAttribute('data-aperto')) {
				cambia(false);
				apri.focus();
			}
		});
	}

	/*
	 * La barra del pollice si scopre quando la prima schermata è passata.
	 * Finché l'eroe è a schermo i tasti sono già visibili lì, e una seconda
	 * copia in fondo sarebbe solo ingombro sopra la fotografia. Un osservatore
	 * solo, nessun ascolto dello scorrimento.
	 */
	var barra = document.getElementById('barra-pollice');
	if (barra && 'IntersectionObserver' in window) {
		var sentinella = document.querySelector('.eroe') || document.querySelector('.testata-pagina');
		if (sentinella) {
			new IntersectionObserver(function (voci) {
				voci.forEach(function (v) {
					if (v.isIntersecting) barra.removeAttribute('data-visibile');
					else barra.setAttribute('data-visibile', '');
				});
			}, { threshold: 0 }).observe(sentinella);
		} else {
			barra.setAttribute('data-visibile', '');
		}
	} else if (barra) {
		barra.setAttribute('data-visibile', '');
	}

	// A che punto è la fila orizzontale.
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
})();

/**
 * I filtri del listino.
 *
 * Vivono qui e non in un file a parte perché sono venti righe, e un secondo
 * file costerebbe più della funzione. Se questo script non arriva, la pagina
 * resta l'elenco completo: lungo, ma intero — nessuna categoria sparisce
 * dietro un filtro che non funziona.
 */
(function () {
	'use strict';
	var filtri = document.querySelector('[data-filtri]');
	if (!filtri) return;

	var pastiglie = [].slice.call(filtri.querySelectorAll('.pastiglia'));
	var cerca = filtri.querySelector('[data-cerca]');
	var blocchi = [].slice.call(document.querySelectorAll('[data-blocco]'));
	if (!blocchi.length) return;

	var avviso = document.createElement('p');
	avviso.className = 'nessun-esito';
	avviso.hidden = true;
	filtri.appendChild(avviso);

	var categoriaScelta = pastiglie.length ? pastiglie[0].dataset.cat : null;

	function applica() {
		var testo = (cerca && cerca.value || '').trim().toLowerCase();
		var trovate = 0;

		blocchi.forEach(function (b) {
			var voci = [].slice.call(b.querySelectorAll('.voce'));
			var visibiliQui = 0;

			voci.forEach(function (v) {
				// Con la ricerca attiva si guarda ovunque: chi scrive il nome
				// non deve prima indovinare in che categoria sta.
				var passa = !testo || (v.dataset.nome || '').indexOf(testo) !== -1;
				v.hidden = !passa;
				if (passa) visibiliQui++;
			});

			var mostra = testo ? visibiliQui > 0 : b.dataset.blocco === categoriaScelta;
			b.hidden = !mostra;
			if (mostra) trovate += visibiliQui;
		});

		if (testo && trovate === 0) {
			avviso.textContent = 'Nessun trattamento con «' + testo + '». Scrivici su WhatsApp: se non è a listino, te lo diciamo subito.';
			avviso.hidden = false;
		} else {
			avviso.hidden = true;
		}

		// Con la ricerca in corso nessuna pastiglia è "quella scelta".
		pastiglie.forEach(function (p) {
			p.setAttribute('aria-pressed', String(!testo && p.dataset.cat === categoriaScelta));
		});
	}

	pastiglie.forEach(function (p) {
		p.addEventListener('click', function () {
			categoriaScelta = p.dataset.cat;
			if (cerca) cerca.value = '';
			applica();
		});
	});
	if (cerca) cerca.addEventListener('input', applica);

	applica();
})();

/*
 * Ripiego per i browser senza timeline di scorrimento (iPhone, Firefox).
 *
 * Dove `animation-timeline` esiste non gira una riga di questo: le
 * animazioni le fa il CSS da solo, senza costi. Dove non esiste, senza
 * questo blocco il sito arriva completamente fermo — ed è quello che
 * succede oggi su iPhone, cioè sulla metà buona di chi ci arriva.
 *
 * L'ordine conta: la classe che nasconde si mette solo dopo aver
 * verificato che c'è un osservatore per toglierla. Al primo giro tutto
 * quello che è già a schermo si accende subito, senza attesa e senza
 * transizione, così sopra la piega non si vede niente di strano.
 */
(function () {
	var moto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: no-preference)');
	if (moto && !moto.matches) return;
	if (window.CSS && CSS.supports && CSS.supports('animation-timeline: view()')) return;
	if (!('IntersectionObserver' in window)) return;

	var pezzi = document.querySelectorAll('.sale, .sipario, .righe .riga');
	if (!pezzi.length) return;

	document.documentElement.classList.add('rb-ripiego');

	/* Rete di sicurezza: se qualcosa va storto — un errore più avanti, una
	   pagina aperta a metà da un'ancora — dopo tre secondi si vede tutto.
	   Un testo invisibile è un guasto, un'animazione mancata è un dettaglio. */
	var salvagente = setTimeout(function () {
		for (var i = 0; i < pezzi.length; i++) pezzi[i].classList.add('rb-dentro');
	}, 3000);

	var osservatore = new IntersectionObserver(function (voci) {
		voci.forEach(function (voce) {
			if (!voce.isIntersecting) return;
			voce.target.classList.add('rb-dentro');
			osservatore.unobserve(voce.target);
		});
	}, { rootMargin: '0px 0px -12% 0px', threshold: 0.08 });

	var alto = window.innerHeight;
	for (var i = 0; i < pezzi.length; i++) {
		var pezzo = pezzi[i];
		if (pezzo.getBoundingClientRect().top < alto) {
			/* Già a schermo quando la pagina arriva. Le righe del titolo
			   dell'eroe salgono lo stesso — è l'ingresso della pagina, e
			   Chrome le anima allo stesso modo con `animation-timeline: auto`;
			   tutto il resto si accende e basta, perché un blocco che compare
			   mentre lo stai già leggendo è un difetto, non un effetto. */
			if (pezzo.closest('.eroe')) {
				(function (p) { requestAnimationFrame(function () { p.classList.add('rb-dentro'); }); })(pezzo);
			} else {
				pezzo.classList.add('rb-dentro');
			}
		} else {
			osservatore.observe(pezzo);
		}
	}

	window.addEventListener('load', function () { clearTimeout(salvagente); }, { once: true });
})();
