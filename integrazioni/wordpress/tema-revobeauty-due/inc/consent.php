<?php
/**
 * Cookie e consenso: Consent Mode v2, con il default a "negato".
 *
 * Il banner del vecchio tema mostrava le categorie ma il tag di Google
 * partiva comunque. Qui l'ordine è quello giusto: prima di qualsiasi script
 * di misurazione va in pagina il default negato; GA4 (Site Kit) e gli altri
 * si adeguano da soli via Consent Mode. La scelta vive nel cookie di prima
 * parte `rb_consenso` per 6 mesi, e dal footer si può sempre riaprire.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

// Nel <head>, PRIMA di ogni altro script: il default negato.
add_action( 'wp_head', function () {
	?>
	<script>
	window.dataLayer = window.dataLayer || [];
	function gtag(){ dataLayer.push(arguments); }
	gtag('consent', 'default', {
		analytics_storage: 'denied',
		ad_storage: 'denied',
		ad_user_data: 'denied',
		ad_personalization: 'denied',
		wait_for_update: 500
	});
	(function () {
		try {
			var salvato = document.cookie.split('; ').find(function (r) { return r.indexOf('rb_consenso=') === 0; });
			if (!salvato) return;
			var scelte = JSON.parse(decodeURIComponent(salvato.split('=')[1]));
			gtag('consent', 'update', {
				analytics_storage: scelte.statistiche ? 'granted' : 'denied',
				ad_storage: scelte.marketing ? 'granted' : 'denied',
				ad_user_data: scelte.marketing ? 'granted' : 'denied',
				ad_personalization: scelte.marketing ? 'granted' : 'denied'
			});
		} catch (e) {}
	})();
	</script>
	<?php
}, 1 );

// Il banner (markup) e il suo script, in fondo alla pagina.
add_action( 'wp_footer', function () {
	?>
	<div class="consenso" id="rb-consenso" hidden>
		<div class="consenso-scatola">
			<p class="consenso-titolo">Rispettiamo la tua privacy</p>
			<p class="consenso-testo">Usiamo cookie tecnici sempre attivi e, solo se accetti, cookie di statistica e marketing. Dettagli nella <a href="<?php echo esc_url( home_url( '/cookie-policy/' ) ); ?>">cookie policy</a>.</p>
			<div class="consenso-scelte">
				<label><input type="checkbox" checked disabled /> Necessari</label>
				<label><input type="checkbox" id="rb-c-statistiche" /> Statistiche</label>
				<label><input type="checkbox" id="rb-c-marketing" /> Marketing</label>
			</div>
			<div class="consenso-azioni">
				<button type="button" class="bottone bottone-oro" id="rb-c-accetta">Accetta tutti</button>
				<button type="button" class="bottone bottone-lineare" id="rb-c-salva">Salva le scelte</button>
				<button type="button" class="bottone bottone-lineare" id="rb-c-rifiuta">Solo necessari</button>
			</div>
		</div>
	</div>
	<script src="<?php echo esc_url( RB_DUE_URI . '/assets/js/consent.js?v=' . RB_DUE_VERSIONE ); ?>" defer></script>
	<?php
}, 99 );
