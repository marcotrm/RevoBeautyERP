<?php
/**
 * Testa della pagina: il critico inline, i font in preload, il resto defer.
 */
$whatsapp = rb_whatsapp_url();
?><!doctype html>
<html <?php language_attributes(); ?>>
<head>
<meta charset="<?php bloginfo( 'charset' ); ?>" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<link rel="preload" href="<?php echo esc_url( RB_DUE_URI . '/assets/fonts/montserrat-variabile-300-700-latin.woff2' ); ?>" as="font" type="font/woff2" crossorigin />
<style><?php
	// Il CSS critico, inline: niente giro di rete prima del primo dipinto.
	$critico = RB_DUE_DIR . '/assets/css/critical.css';
	if ( is_readable( $critico ) ) {
		// Il CSS è inline: gli URL relativi si romperebbero contro l'URL della
		// pagina, quindi i font usano un segnaposto risolto qui.
		echo str_replace( '__RB_FONTS__', RB_DUE_URI . '/assets/fonts', file_get_contents( $critico ) ); // phpcs:ignore
	}
?></style>
<?php wp_head(); ?>
</head>
<body <?php body_class(); ?>>
<?php wp_body_open(); ?>

<a class="salta" href="#contenuto">Vai al contenuto</a>

<?php if ( is_front_page() ) : ?>
<?php /*
	La schermata di entrata: due pannelli neri, il logotipo che emerge, una
	barra sottile, poi il sipario si apre. Parte SOLO alla prima visita
	(localStorage, vedi motion.js) e solo se il movimento non è ridotto:
	nell'HTML arriva spenta (hidden) e senza JS non esiste — la pagina
	sotto è già completa. Coreografia presa dal preload di lindas,
	compressa da 3,5 a ~2,2 secondi: l'attesa scenografica va bene una
	volta, non a ogni caffè.
*/ ?>
<div class="entrata" id="rb-entrata" hidden aria-hidden="true">
	<div class="entrata-pannello entrata-sopra"></div>
	<div class="entrata-pannello entrata-sotto"></div>
	<div class="entrata-scena">
		<span class="entrata-logotipo"><span class="firma-revo">REVO</span><span class="firma-beauty">BEAUTY</span></span>
		<span class="entrata-riga">Maddaloni · Via Caudina 30</span>
	</div>
	<div class="entrata-barra"><span></span></div>
</div>
<script>
/* Acceso qui e non nel bundle: il bundle è differito e arriverebbe a pagina
   già dipinta — l'intro deve esserci al primo pennello o non esserci. */
(function () {
	try {
		if (localStorage.getItem('rb_intro')) return;
		if (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		var e = document.getElementById('rb-entrata');
		e.hidden = false;
		e.classList.add('entrata-avviata');
		document.body.setAttribute('data-entrata', '');
		localStorage.setItem('rb_intro', '1');
	} catch (err) {}
})();
</script>
<?php endif; ?>

<?php /* La testata è scura ovunque: le pagine interne ora si aprono con
	la loro scena nera (vedi .testata-pagina) e il footer chiude in nero —
	il contenuto sta tra due bande scure, come un fotogramma. In home resta
	anche il galleggiamento sull'eroe (testata-cinema). */ ?>
<header class="testata testata-scura<?php echo is_front_page() ? ' testata-cinema' : ''; ?>">
	<div class="testata-dentro">
		<a class="marchio" href="<?php echo esc_url( home_url( '/' ) ); ?>" aria-label="RevoBeauty — home">
			<span class="marchio-revo">REVO</span><span class="marchio-beauty">BEAUTY</span>
		</a>
		<nav class="nav" aria-label="Principale">
			<?php
			wp_nav_menu( array(
				'theme_location' => 'principale',
				'container'      => false,
				'items_wrap'     => '<ul class="menu">%3$s</ul>',
				'fallback_cb'    => 'rb_menu_fallback',
				'depth'          => 1,
			) );
			?>
		</nav>
		<div class="testata-azioni">
			<?php if ( $whatsapp ) : ?>
				<a class="bottone bottone-oro bottone-piccolo" href="<?php echo esc_url( $whatsapp ); ?>" rel="noopener">Prenota su WhatsApp</a>
			<?php endif; ?>
			<?php /* L'icona da sola non basta: senza la parola scritta, quante persone
				trovano la navigazione si dimezza. Costa tre lettere. */ ?>
			<button class="apri-menu" aria-expanded="false" aria-controls="menu-mobile">
				<svg class="segno-menu" width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M3 6h16M3 11h16M3 16h16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
				<svg class="segno-chiudi" width="20" height="20" viewBox="0 0 22 22" fill="none" aria-hidden="true"><path d="M5 5l12 12M17 5L5 17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>
				<span class="parola-menu">Menu</span>
				<span class="parola-chiudi">Chiudi</span>
			</button>
		</div>
	</div>
	<div class="menu-mobile" id="menu-mobile" hidden>
		<?php
		wp_nav_menu( array(
			'theme_location' => 'principale',
			'container'      => false,
			'items_wrap'     => '<ul class="menu-mobile-voci">%3$s</ul>',
			'fallback_cb'    => 'rb_menu_fallback',
			'depth'          => 1,
		) );
		?>
		<?php if ( $whatsapp ) : ?>
			<a class="bottone bottone-oro" href="<?php echo esc_url( $whatsapp ); ?>" rel="noopener">Prenota su WhatsApp</a>
		<?php endif; ?>
	</div>
</header>

<main id="contenuto">
