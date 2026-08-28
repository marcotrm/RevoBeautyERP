<?php
/**
 * Il gestionale come fonte di verità: listino, orari, indirizzo, team.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * PERCHÉ COSÌ
 *
 * Il tema precedente aveva prezzi e orari scritti nei template. Il confronto
 * del 27 agosto 2026 li ha trovati sbagliati (Bendaggi 49,90 € sul sito,
 * 20,00 € in gestionale — e gli orari di apertura inventati). Finché il dato
 * vive in due posti, torna a divergere: qui vive in uno solo, il gestionale,
 * e il sito lo legge.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * COME REGGE QUANDO IL GESTIONALE NON RISPONDE
 *
 * Due livelli, per ogni percorso chiamato:
 *
 *   transient  (10 minuti)  →  la copia fresca, quella servita di norma
 *   option     (mai scade)  →  l'ultima copia buona, il paracadute
 *
 * Se l'ERP è giù il sito serve l'ultima copia buona e non se ne accorge
 * nessuno. Se non c'è nemmeno quella (installazione appena fatta, ERP giù),
 * i template mostrano l'invito a chiamare o scrivere su WhatsApp — mai un
 * prezzo vuoto, mai un errore.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** L'ERP: sovrascrivibile da wp-config con REVOBEAUTY_ERP_URL (es. in locale). */
function rb_erp_base() {
	return rtrim( defined( 'REVOBEAUTY_ERP_URL' ) ? REVOBEAUTY_ERP_URL : 'https://erp.revobeauty.it', '/' );
}

/**
 * GET verso l'ERP con transient + ultima copia buona.
 *
 * @param string $percorso  Percorso API, es. '/api/listino/dati'.
 * @param int    $ttl       Vita della copia fresca, in secondi.
 * @param bool   $forza     true = ignora il transient (la usa il cron).
 * @return array|null       Il JSON decodificato, o null se non c'è proprio niente.
 */
function rb_erp_get( $percorso, $ttl = 600, $forza = false ) {
	$chiave = 'rb_erp_' . md5( $percorso );

	if ( ! $forza ) {
		$fresco = get_transient( $chiave );
		if ( false !== $fresco ) {
			return $fresco;
		}
	}

	$risposta = wp_remote_get(
		rb_erp_base() . $percorso,
		array(
			'timeout' => 8,
			// Il listino sta in poche decine di KB. Mezzo mega è già dieci volte
			// il necessario, e mette al riparo dal caso in cui dall'altra parte
			// esca per errore qualcosa di enorme: senza tetto finirebbe prima
			// nella memoria di PHP e poi dentro wp_options.
			'limit_response_size' => 512 * KB_IN_BYTES,
		)
	);

	if ( ! is_wp_error( $risposta ) && 200 === (int) wp_remote_retrieve_response_code( $risposta ) ) {
		$dati = json_decode( wp_remote_retrieve_body( $risposta ), true );
		if ( is_array( $dati ) ) {
			set_transient( $chiave, $dati, $ttl );
			update_option( 'rb_erp_paracadute_' . md5( $percorso ), $dati, false );
			return $dati;
		}
	}

	// ERP giù o risposta storta: l'ultima copia buona, per sempre.
	$paracadute = get_option( 'rb_erp_paracadute_' . md5( $percorso ), null );
	if ( is_array( $paracadute ) ) {
		// Rimessa nel transient con vita breve: non martelliamo un ERP giù
		// a ogni visita, ma riproviamo presto.
		set_transient( $chiave, $paracadute, MINUTE_IN_SECONDS );
		return $paracadute;
	}

	/*
	 * Nemmeno la copia di scorta: gestionale giù prima ancora della prima
	 * lettura riuscita. Senza questa riga ogni singola visita rifarebbe la
	 * chiamata e aspetterebbe gli otto secondi del timeout — due volte, perché
	 * il footer chiede il centro e la home chiede il team: sedici secondi a
	 * pagina, i processi del sito esauriti in pochi istanti e il sito giù per
	 * intero. Si segna il buco per un minuto e si serve la pagina senza prezzi,
	 * che è quello che i template sanno già fare.
	 */
	set_transient( $chiave, array(), MINUTE_IN_SECONDS );
	return null;
}

/** Listino completo: categorie, trattamenti (donna/uomo), pacchetti, centro. */
function rb_listino() {
	return rb_erp_get( '/api/listino/dati' );
}

/** Il blocco centro (nome, indirizzo, telefono, orari, chiusure), o null. */
function rb_centro() {
	$listino = rb_listino();
	return is_array( $listino ) && ! empty( $listino['centro'] ) ? $listino['centro'] : null;
}

/** Le operatrici prenotabili (id, nome, nomeBreve, avatar, categorie). */
function rb_staff() {
	$dati = rb_erp_get( '/api/booking/operators' );
	return is_array( $dati ) && ! empty( $dati['operators'] ) ? $dati['operators'] : array();
}

/** Il telefono del centro in formato tel: (+39...), o '' se non c'è. */
function rb_telefono() {
	$centro = rb_centro();
	$grezzo = $centro['telefono'] ?? '';
	$pulito = preg_replace( '/[^0-9+]/', '', (string) $grezzo );
	return $pulito ?: '';
}

/** Link WhatsApp del centro (wa.me), o '' se il telefono non c'è. */
function rb_whatsapp_url() {
	$tel = rb_telefono();
	if ( ! $tel ) {
		return '';
	}
	$numero = ltrim( $tel, '+' );
	if ( ! str_starts_with( $numero, '39' ) ) {
		$numero = '39' . $numero;
	}
	return 'https://wa.me/' . $numero;
}

/** L'URL della prenotazione online sul gestionale. */
function rb_prenota_url() {
	return rb_erp_base() . '/prenota';
}

/** I nomi delle categorie, dall'inglese del database all'italiano della vetrina. */
function rb_nome_categoria( $slug ) {
	$nomi = array(
		'laser'        => 'Epilazione laser',
		'waxing'       => 'Depilazione',
		'body'         => 'Corpo',
		'facial'       => 'Viso',
		'massage'      => 'Massaggi',
		'nails'        => 'Unghie',
		'consultation' => 'Consulenza',
		'makeup'       => 'Trucco',
		'hair'         => 'Capelli',
	);
	return $nomi[ $slug ] ?? ucfirst( $slug );
}

/**
 * L'ordine di vetrina delle categorie: prima il laser (la punta di diamante,
 * 43 voci a listino), poi corpo e viso, in coda la consulenza. L'ordine
 * alfabetico del database è in inglese e metterebbe il laser in mezzo.
 */
function rb_ordina_categorie( $slugs ) {
	$peso = array_flip( array( 'laser', 'body', 'facial', 'massage', 'nails', 'waxing', 'consultation', 'makeup', 'hair' ) );
	usort( $slugs, function ( $a, $b ) use ( $peso ) {
		return ( $peso[ $a ] ?? 99 ) <=> ( $peso[ $b ] ?? 99 );
	} );
	return $slugs;
}

/** Prezzo in €: 20 → "20 €", 49.9 → "49,90 €". */
function rb_prezzo( $valore ) {
	if ( null === $valore || '' === $valore ) {
		return '';
	}
	$n = (float) $valore;
	$testo = ( floor( $n ) == $n ) ? number_format( $n, 0, ',', '.' ) : number_format( $n, 2, ',', '.' );
	return $testo . ' €';
}

/** Orari di apertura come righe pronte da stampare: [ ['Lun – Ven','09:00 – 19:00'], ... ]. */
function rb_orari_righe() {
	$centro = rb_centro();
	$orari  = $centro['orari'] ?? null;
	if ( ! is_array( $orari ) ) {
		return array();
	}

	$giorni = array( 1 => 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom' );

	// Compattazione dei giorni consecutivi con lo stesso orario.
	$righe   = array();
	$corrente = null;
	for ( $g = 1; $g <= 7; $g++ ) {
		$fascia = $orari[ (string) $g ] ?? null;
		$testo  = ( is_array( $fascia ) && isset( $fascia['apre'], $fascia['chiude'] ) )
			? ( $fascia['apre'] . ' – ' . $fascia['chiude'] )
			: 'Chiuso';
		if ( $corrente && $corrente['testo'] === $testo && $corrente['fine'] === $g - 1 ) {
			$corrente['fine'] = $g;
		} else {
			if ( $corrente ) {
				$righe[] = $corrente;
			}
			$corrente = array( 'inizio' => $g, 'fine' => $g, 'testo' => $testo );
		}
	}
	if ( $corrente ) {
		$righe[] = $corrente;
	}

	return array_map( function ( $r ) use ( $giorni ) {
		$nome = $r['inizio'] === $r['fine']
			? $giorni[ $r['inizio'] ]
			: $giorni[ $r['inizio'] ] . ' – ' . $giorni[ $r['fine'] ];
		return array( $nome, $r['testo'] );
	}, $righe );
}

/* ─────────────────────────────────────────────────────────────────────────
 * Il cron che tiene la cache calda e svuota LiteSpeed quando cambia qualcosa.
 *
 * La pagina servita da LiteSpeed è HTML già pronto: se cambia un prezzo in
 * gestionale, senza questo giro il sito lo mostrerebbe alla scadenza della
 * page cache (giorni). Ogni 10 minuti si richiede il listino fresco; se
 * l'impronta è diversa dall'ultima volta, si chiede a LiteSpeed di rifare
 * le pagine che stampano quei dati.
 * ───────────────────────────────────────────────────────────────────────── */

add_filter( 'cron_schedules', function ( $piani ) {
	$piani['rb_dieci_minuti'] = array(
		'interval' => 10 * MINUTE_IN_SECONDS,
		'display'  => 'Ogni 10 minuti (listino RevoBeauty)',
	);
	return $piani;
} );

add_action( 'after_switch_theme', function () {
	if ( ! wp_next_scheduled( 'rb_aggiorna_listino' ) ) {
		wp_schedule_event( time() + MINUTE_IN_SECONDS, 'rb_dieci_minuti', 'rb_aggiorna_listino' );
	}
} );

add_action( 'switch_theme', function () {
	wp_clear_scheduled_hook( 'rb_aggiorna_listino' );
} );

add_action( 'rb_aggiorna_listino', function () {
	$listino = rb_erp_get( '/api/listino/dati', 600, true );
	rb_erp_get( '/api/booking/operators', 600, true );

	if ( ! is_array( $listino ) ) {
		return;
	}

	$impronta = md5( wp_json_encode( array( $listino['trattamenti'] ?? null, $listino['pacchetti'] ?? null, $listino['centro'] ?? null ) ) );
	if ( get_option( 'rb_erp_impronta' ) === $impronta ) {
		return;
	}
	update_option( 'rb_erp_impronta', $impronta, false );

	// LiteSpeed, se c'è: via le copie delle pagine che stampano listino e orari.
	if ( has_action( 'litespeed_purge_url' ) ) {
		foreach ( array( '/', '/servizi/', '/contatti/', '/chi-siamo/' ) as $url ) {
			do_action( 'litespeed_purge_url', $url );
		}
	}
} );
