<?php
/**
 * Impostazioni di base del tema: cosa supporta, cosa carica, cosa spegne.
 *
 * La parte "cosa spegne" è metà del punteggio PageSpeed: WordPress di suo
 * carica emoji, embed e blocchi CSS che queste pagine non usano mai.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'after_setup_theme', function () {
	add_theme_support( 'title-tag' );
	add_theme_support( 'post-thumbnails' );
	add_theme_support( 'html5', array( 'search-form', 'gallery', 'caption', 'style', 'script' ) );

	register_nav_menus( array( 'principale' => 'Menu principale' ) );
} );

add_action( 'wp_enqueue_scripts', function () {
	// Un CSS solo, piccolo: il critico sta inline in header.php.
	wp_enqueue_style( 'rb-due', RB_DUE_URI . '/assets/css/main.css', array(), RB_DUE_VERSIONE );

	// Un JS solo, defer: reveal allo scroll e menu mobile. Niente librerie.
	wp_enqueue_script( 'rb-due-motion', RB_DUE_URI . '/assets/js/motion.js', array(), RB_DUE_VERSIONE, array( 'strategy' => 'defer' ) );

	// jQuery non serve a niente qui: caricarlo costa più di tutto il nostro JS.
	if ( ! is_admin() ) {
		wp_deregister_script( 'jquery' );
	}
} );

/* Il CSS del tema è già minimale: fargli fare un giro in più dentro
   l'ottimizzatore di LiteSpeed può solo rompere l'ordine del critico inline. */
add_filter( 'litespeed_optimize_css', '__return_false' );

/**
 * La pagina del modulo non va in cache.
 *
 * Il modulo porta un nonce, che vive 24 ore. Se la pagina è HTML congelato da
 * LiteSpeed, quel nonce viene servito uguale a tutti finché la copia non viene
 * rifatta — e la copia si rifà solo quando cambia il listino, cioè magari fra
 * una settimana. Passate le 24 ore ogni invio finirebbe nel ramo «la pagina è
 * rimasta aperta troppo a lungo» e il contatto sarebbe perso senza che nessuno
 * se ne accorga: esattamente il guasto che questo tema esiste per chiudere.
 */
add_action( 'wp', function () {
	if ( ! is_page( 'contatti' ) && ! ( is_singular() && has_shortcode( (string) get_post_field( 'post_content', get_the_ID() ), 'revobeauty_contatti' ) ) ) {
		return;
	}
	do_action( 'litespeed_control_set_nocache', 'modulo contatti: il nonce deve essere fresco' );
} );

// Zavorra di default che queste pagine non usano.
add_action( 'init', function () {
	remove_action( 'wp_head', 'print_emoji_detection_script', 7 );
	remove_action( 'wp_print_styles', 'print_emoji_styles' );
	remove_action( 'wp_head', 'wp_generator' );
	remove_action( 'wp_head', 'wlwmanifest_link' );
	remove_action( 'wp_head', 'rsd_link' );
	remove_action( 'wp_head', 'wp_shortlink_wp_head' );
	remove_action( 'wp_head', 'rest_output_link_wp_head' );
	remove_action( 'wp_head', 'wp_oembed_add_discovery_links' );
	remove_action( 'wp_head', 'wp_oembed_add_host_js' );
} );

// I blocchi Gutenberg si usano solo negli articoli: il loro CSS globale no.
add_action( 'wp_enqueue_scripts', function () {
	if ( ! is_singular( 'post' ) && ! is_home() ) {
		wp_dequeue_style( 'wp-block-library' );
		wp_dequeue_style( 'global-styles' );
		wp_dequeue_style( 'classic-theme-styles' );
	}
}, 20 );

/** Le voci di menu quando nessun menu è stato configurato in bacheca. */
function rb_menu_fallback() {
	$voci = array(
		home_url( '/servizi/' )   => 'Trattamenti',
		home_url( '/chi-siamo/' ) => 'Chi siamo',
		home_url( '/blog/' )      => 'Blog',
		home_url( '/contatti/' )  => 'Contatti',
	);
	echo '<ul class="menu">';
	foreach ( $voci as $url => $etichetta ) {
		printf( '<li><a href="%s">%s</a></li>', esc_url( $url ), esc_html( $etichetta ) );
	}
	echo '</ul>';
}
