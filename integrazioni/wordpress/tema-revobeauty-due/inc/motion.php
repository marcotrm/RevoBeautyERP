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
