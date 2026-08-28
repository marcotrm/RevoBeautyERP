<?php
/**
 * I dati strutturati: BeautySalon con gli orari veri.
 *
 * Il punto non è il markup, è la fonte: l'openingHoursSpecification viene da
 * rb_centro(), cioè dal gestionale. Il giorno che il centro cambia orario,
 * cambia anche qui — senza che nessuno tocchi il sito.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_head', function () {
	if ( ! is_front_page() && ! is_page( array( 'contatti', 'chi-siamo' ) ) ) {
		return;
	}

	$centro = rb_centro();
	if ( ! $centro ) {
		return;
	}

	$giorni_schema = array( 1 => 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday' );
	$apertura      = array();
	foreach ( (array) ( $centro['orari'] ?? array() ) as $giorno => $fascia ) {
		if ( ! $fascia || empty( $giorni_schema[ (int) $giorno ] ) ) {
			continue;
		}
		$apertura[] = array(
			'@type'     => 'OpeningHoursSpecification',
			'dayOfWeek' => $giorni_schema[ (int) $giorno ],
			'opens'     => $fascia['apre'],
			'closes'    => $fascia['chiude'],
		);
	}

	$dati = array(
		'@context'  => 'https://schema.org',
		'@type'     => 'BeautySalon',
		'name'      => $centro['nome'] ?? 'RevoBeauty',
		'url'       => home_url( '/' ),
		'telephone' => $centro['telefono'] ?? '',
		'address'   => array(
			'@type'           => 'PostalAddress',
			'streetAddress'   => $centro['indirizzo'] ?? '',
			'addressLocality' => 'Maddaloni',
			'addressRegion'   => 'CE',
			'addressCountry'  => 'IT',
		),
		'openingHoursSpecification' => $apertura,
	);

	printf( "<script type=\"application/ld+json\">%s</script>\n", wp_json_encode( $dati, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE ) );
}, 5 );

// Yoast stampa già Organization/WebSite: il local business lo mettiamo noi,
// il suo blocco organizzazione si toglie per non duplicare.
add_filter( 'wpseo_schema_organization', '__return_false' );
