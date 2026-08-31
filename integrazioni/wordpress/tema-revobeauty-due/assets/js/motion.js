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

	/* Due specie di contenitori si osservano interi, non pezzo per pezzo.
	   Le file orizzontali, perché le carte fuori campo di lato non
	   intersecherebbero mai e resterebbero invisibili per sempre. E i
	   blocchi del listino, perché sono cento voci l'uno: cento osservatori
	   per una pagina sola sono lavoro buttato — si accende il blocco, e il
	   blocco accende le sue voci. */
	var CONTENITORI = '.scorri, .blocco-listino';
	var pezzi = [].filter.call(
		document.querySelectorAll('.sale, .sipario, .righe .riga'),
		function (e) { return !e.closest(CONTENITORI); }
	);
	pezzi = pezzi.concat([].slice.call(document.querySelectorAll(CONTENITORI)));
	if (!pezzi.length) return;

	document.documentElement.classList.add('rb-ripiego');

	/* Rete di sicurezza: se qualcosa va storto — un errore più avanti, una
	   pagina aperta a metà da un'ancora — dopo tre secondi si vede tutto.
	   Un testo invisibile è un guasto, un'animazione mancata è un dettaglio. */
	var salvagente = setTimeout(function () {
		for (var i = 0; i < pezzi.length; i++) pezzi[i].classList.add('rb-dentro');
		var fila = document.querySelectorAll('.scorri .sale, .blocco-listino .sale');
		for (var j = 0; j < fila.length; j++) fila[j].classList.add('rb-dentro');
	}, 3000);

	var osservatore = new IntersectionObserver(function (voci) {
		voci.forEach(function (voce) {
			if (!voce.isIntersecting) return;
			voce.target.classList.add('rb-dentro');
			var dentro = voce.target.querySelectorAll ? voce.target.querySelectorAll('.sale') : [];
			for (var k = 0; k < dentro.length; k++) dentro[k].classList.add('rb-dentro');
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

/*
 * Lo smontaggio della schermata di entrata.
 *
 * Ad accenderla è uno script inline in header.php (il bundle è differito e
 * arriverebbe a pagina già dipinta). Qui si smonta a sipario aperto, con un
 * salvagente: un'intro che resta appesa è un sito rotto.
 */
(function () {
	var entrata = document.getElementById('rb-entrata');
	if (!entrata) return;
	if (!entrata.classList.contains('entrata-avviata')) { entrata.remove(); return; }

	var via = function () {
		if (!entrata.parentNode) return;
		entrata.remove();
		document.body.removeAttribute('data-entrata');
	};
	entrata.querySelector('.entrata-sopra').addEventListener('animationend', via);
	setTimeout(via, 3500);
})();

/*
 * Il volo del logotipo dall'eroe alla testata.
 *
 * Il movimento è un'animazione CSS su timeline di scorrimento: qui si fa
 * solo quello che il CSS non può fare da solo — misurare dove deve
 * atterrare. Le misure usano offsetLeft/offsetWidth e non
 * getBoundingClientRect sul logotipo: i valori di layout ignorano il
 * transform, così si può rimisurare al volo senza azzerarlo (trucco preso
 * dai commenti del sito di riferimento). La classe con-volo si mette solo
 * quando tutto il necessario c'è: senza, il logotipo resta il titolo
 * dell'eroe e il marchio in testata torna visibile.
 */
(function () {
	var volo = document.getElementById('rb-volo');
	if (!volo) return;
	var parola = volo.querySelector('.volo-parola');
	var slot = document.querySelector('.testata-cinema .marchio');
	var eroe = document.querySelector('.eroe-cinema');
	var testata = document.querySelector('.testata-cinema');
	if (!parola || !slot || !eroe || !testata) return;

	var ridotto = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
	if (ridotto) return;
	if (!(window.CSS && CSS.supports && CSS.supports('animation-timeline: scroll()'))) return;

	var misura = function () {
		var lw = parola.offsetWidth, lh = parola.offsetHeight;
		var lx = 0, ly = 0, e = parola;
		while (e) { lx += e.offsetLeft; ly += e.offsetTop; e = e.offsetParent; }
		var s = slot.getBoundingClientRect();
		if (!lw || !s.width) return;
		var scala = s.width / lw;
		if (!isFinite(scala) || scala <= 0.01 || scala > 1) return;
		parola.style.setProperty('--scala', String(scala));
		parola.style.setProperty('--dx', ((s.left + s.width / 2) - (lx + lw / 2)) + 'px');
		parola.style.setProperty('--dy', ((s.top + s.height / 2) - (ly + lh / 2)) + 'px');
	};

	var arma = function () {
		/* Prima la classe, poi la misura: da fisso, le coordinate del
		   logotipo e quelle dello slot vivono nello stesso sistema (il
		   viewport) anche se la pagina è ricaricata a metà scorrimento. */
		document.documentElement.classList.add('con-volo');
		requestAnimationFrame(misura);
	};
	if (document.fonts && document.fonts.ready) {
		var fatto = false;
		var una = function () { if (!fatto) { fatto = true; arma(); } };
		document.fonts.ready.then(una);
		setTimeout(una, 3000);
	} else {
		arma();
	}
	window.addEventListener('resize', misura);

	/* L'aggancio: finito l'eroe, il logotipo smette di essere in
	   differenza e la testata riprende corpo. Solo classi, niente stile
	   inline: il lavoro per pixel lo fa la timeline CSS. */
	var agganciato = false;
	var controlla = function () {
		var ora = window.scrollY >= eroe.offsetHeight - testata.offsetHeight;
		if (ora === agganciato) return;
		agganciato = ora;
		volo.classList.toggle('volo-agganciato', ora);
		volo.classList.toggle('tono-scuro', ora);
		testata.classList.toggle('testata-agganciata', ora);
	};
	window.addEventListener('scroll', controlla, { passive: true });
	controlla();
})();

/*
 * Le animazioni infinite si fermano fuori dallo schermo: la giostra dei
 * trattamenti e i fotogrammi dell'eroe non hanno motivo di girare quando
 * nessuno li guarda.
 */
(function () {
	if (!('IntersectionObserver' in window)) return;
	var pezzi = document.querySelectorAll('.giostra, .eroe-cinema');
	if (!pezzi.length) return;
	var occhio = new IntersectionObserver(function (voci) {
		voci.forEach(function (voce) {
			if (voce.isIntersecting) {
				voce.target.removeAttribute('data-fermo');
			} else {
				voce.target.setAttribute('data-fermo', '');
			}
		});
	}, { rootMargin: '80px 0px' });
	for (var i = 0; i < pezzi.length; i++) occhio.observe(pezzi[i]);
})();
