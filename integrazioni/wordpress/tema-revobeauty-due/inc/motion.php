<?php
/**
 * Il poco PHP che serve al movimento.
 *
 * Le animazioni sono tutte in CSS legate allo scorrimento: qui dentro c'è
 * solo quello che il CSS non può fabbricarsi da solo, cioè il markup.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Spezza una frase in parole, ognuna numerata.
 *
 * Serve alla frase che si "inchiostra" mentre la si legge. Lo sfalsamento
 * non si può fare con animation-delay — su una timeline di scorrimento il
 * ritardo non ha significato, perché il tempo lo detta il dito — quindi
 * ogni parola porta il proprio indice in `--i` e sposta il proprio
 * intervallo di qualche punto percentuale.
 *
 * Lo spazio sta DENTRO lo span, non fra uno span e l'altro: se il CSS non
 * si applica o l'HTML viene ripulito da qualcosa, le parole restano
 * separate invece di incollarsi in un unico blocco illeggibile.
 */
function rb_parole( $testo ) {
	$parole = preg_split( '/\s+/u', trim( (string) $testo ), -1, PREG_SPLIT_NO_EMPTY );
	if ( ! $parole ) {
		return '';
	}

	$out = '';
	foreach ( $parole as $i => $parola ) {
		$out .= sprintf(
			'<span class="parola" style="--i:%d">%s </span>',
			(int) $i,
			esc_html( $parola )
		);
	}

	return $out;
}

/**
 * I trattamenti per la giostra della home.
 *
 * Un paio per categoria, nell'ordine vero del listino: abbastanza varietà
 * da far vedere che il centro fa tante cose, abbastanza pochi da non
 * trasformare la home in un secondo listino. I dati sono quelli live del
 * gestionale: se un prezzo cambia lì, cambia anche qui.
 */
function rb_giostra_trattamenti( $per_categoria = 2, $massimo = 14 ) {
	$listino = rb_listino();
	if ( ! is_array( $listino ) || empty( $listino['trattamenti'] ) ) {
		return array();
	}

	$per_slug = array();
	foreach ( $listino['trattamenti'] as $trattamento ) {
		$slug = $trattamento['categoria'] ?? '';
		if ( ! $slug || count( $per_slug[ $slug ] ?? array() ) >= $per_categoria ) {
			continue;
		}
		$per_slug[ $slug ][] = $trattamento;
	}

	$scelti = array();
	foreach ( rb_ordina_categorie( array_keys( $per_slug ) ) as $slug ) {
		foreach ( $per_slug[ $slug ] as $trattamento ) {
			$scelti[] = $trattamento;
		}
	}

	return array_slice( $scelti, 0, $massimo );
}
