/**
 * Il banner del consenso: mostra, salva, aggiorna Google Consent Mode.
 * Il default negato è già in pagina (inc/consent.php) prima di ogni tag.
 */
(function () {
	'use strict';

	var NOME = 'rb_consenso';
	var banner = document.getElementById('rb-consenso');
	if (!banner) return;

	function leggi() {
		var riga = document.cookie.split('; ').find(function (r) { return r.indexOf(NOME + '=') === 0; });
		if (!riga) return null;
		try { return JSON.parse(decodeURIComponent(riga.split('=')[1])); } catch (e) { return null; }
	}

	function salva(scelte) {
		var seiMesi = 60 * 60 * 24 * 182;
		document.cookie = NOME + '=' + encodeURIComponent(JSON.stringify(scelte)) +
			'; max-age=' + seiMesi + '; path=/; SameSite=Lax' +
			(location.protocol === 'https:' ? '; Secure' : '');
		if (typeof gtag === 'function') {
			gtag('consent', 'update', {
				analytics_storage: scelte.statistiche ? 'granted' : 'denied',
				ad_storage: scelte.marketing ? 'granted' : 'denied',
				ad_user_data: scelte.marketing ? 'granted' : 'denied',
				ad_personalization: scelte.marketing ? 'granted' : 'denied'
			});
		}
		banner.hidden = true;
	}

	function mostra() {
		var scelte = leggi() || {};
		document.getElementById('rb-c-statistiche').checked = !!scelte.statistiche;
		document.getElementById('rb-c-marketing').checked = !!scelte.marketing;
		banner.hidden = false;
	}

	document.getElementById('rb-c-accetta').addEventListener('click', function () {
		salva({ statistiche: true, marketing: true });
	});
	document.getElementById('rb-c-rifiuta').addEventListener('click', function () {
		salva({ statistiche: false, marketing: false });
	});
	document.getElementById('rb-c-salva').addEventListener('click', function () {
		salva({
			statistiche: document.getElementById('rb-c-statistiche').checked,
			marketing: document.getElementById('rb-c-marketing').checked
		});
	});

	var gestisci = document.getElementById('rb-gestisci-cookie');
	if (gestisci) gestisci.addEventListener('click', mostra);

	if (!leggi()) mostra();
})();
