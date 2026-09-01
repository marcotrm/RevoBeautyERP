<?php
/**
 * Le pagine di categoria: /trattamenti/epilazione-laser/, /trattamenti/viso/…
 *
 * Sono pagine virtuali: non esistono in bacheca, esistono nel listino.
 * Il gestionale è la fonte di verità anche per l'elenco delle pagine — se
 * domani il centro apre una categoria nuova, la sua pagina nasce da sola,
 * con i prezzi veri, senza che nessuno tocchi WordPress.
 *
 * Servono a due cose: dare a ogni specializzazione una pagina da linkare
 * (dalle inserzioni, da Google, dalla home) e dare a Google una pagina a
 * tema unico per ogni ricerca che conta («epilazione laser maddaloni»).
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/** Da slug del listino a pezzo di URL leggibile, e ritorno. */
function rb_categoria_percorsi() {
	return array(
		'epilazione-laser' => 'laser',
		'depilazione'      => 'waxing',
		'corpo'            => 'body',
		'viso'             => 'facial',
		'massaggi'         => 'massage',
		'unghie'           => 'nails',
		'consulenza'       => 'consultation',
		'trucco'           => 'makeup',
		'capelli'          => 'hair',
	);
}

function rb_categoria_url( $slug ) {
	$percorso = array_search( $slug, rb_categoria_percorsi(), true );
	return $percorso ? home_url( '/trattamenti/' . $percorso . '/' ) : home_url( '/servizi/#' . $slug );
}

add_action( 'init', function () {
	add_rewrite_rule( '^trattamenti/([a-z-]+)/?$', 'index.php?rb_categoria=$matches[1]', 'top' );
	add_rewrite_rule( '^sitemap-trattamenti\.xml$', 'index.php?rb_sitemap=trattamenti', 'top' );

	/* Le regole di riscrittura vivono nel database: una regola nuova nel
	   codice non esiste finché qualcuno non le rigenera. Lo si fa da soli,
	   una volta per versione del tema — mai a ogni richiesta, che è il
	   modo classico di mettere in ginocchio un sito. */
	if ( get_option( 'rb_permalink_versione' ) !== RB_DUE_VERSIONE . '-trattamenti' ) {
		flush_rewrite_rules( false );
		update_option( 'rb_permalink_versione', RB_DUE_VERSIONE . '-trattamenti' );
	}
} );

add_filter( 'query_vars', function ( $vars ) {
	$vars[] = 'rb_categoria';
	$vars[] = 'rb_sitemap';
	return $vars;
} );

/** Lo slug di listino della pagina corrente, o stringa vuota. */
function rb_categoria_corrente() {
	$percorso = get_query_var( 'rb_categoria' );
	return $percorso ? ( rb_categoria_percorsi()[ $percorso ] ?? '' ) : '';
}

add_filter( 'template_include', function ( $template ) {
	$percorso = get_query_var( 'rb_categoria' );
	if ( ! $percorso ) {
		return $template;
	}
	if ( ! rb_categoria_corrente() ) {
		// Un percorso che non è una categoria resta un 404 vero.
		global $wp_query;
		$wp_query->set_404();
		status_header( 404 );
		return get_404_template();
	}
	status_header( 200 );
	return RB_DUE_DIR . '/page-categoria.php';
} );

/* Titolo e descrizione: la pagina non è in bacheca, quindi Yoast non la
   conosce — e sul sito vero la scambiava per il blog, stampando il SUO
   titolo e soprattutto il canonical di /blog/: per Google ogni categoria
   sarebbe diventata una copia del blog. La regola: i valori giusti
   passano ANCHE dai filtri di Yoast, e i tag stampati a mano dal tema
   escono solo quando Yoast non c'è — mai doppioni nell'head. */

function rb_categoria_titolo_seo( $slug ) {
	return rb_nome_categoria( $slug ) . ' a Maddaloni — prezzi e durate | RevoBeauty';
}

function rb_categoria_descrizione( $slug ) {
	return sprintf(
		'%s da RevoBeauty a Maddaloni (CE): %d trattamenti con prezzi e durate dal listino, sempre aggiornati. Prima consulenza gratuita, si prenota su WhatsApp.',
		rb_nome_categoria( $slug ),
		count( rb_categoria_dati( $slug )['voci'] )
	);
}

/* Priorità 99: Yoast filtra lo stesso aggancio a 15 e vincerebbe lui. */
add_filter( 'pre_get_document_title', function ( $titolo ) {
	$slug = rb_categoria_corrente();
	return $slug ? rb_categoria_titolo_seo( $slug ) : $titolo;
}, 99 );

add_filter( 'wpseo_title', function ( $titolo ) {
	$slug = rb_categoria_corrente();
	return $slug ? rb_categoria_titolo_seo( $slug ) : $titolo;
} );

add_filter( 'wpseo_metadesc', function ( $desc ) {
	$slug = rb_categoria_corrente();
	return $slug ? rb_categoria_descrizione( $slug ) : $desc;
} );

add_filter( 'wpseo_canonical', function ( $canonico ) {
	$slug = rb_categoria_corrente();
	return $slug ? rb_categoria_url( $slug ) : $canonico;
} );

add_filter( 'wpseo_opengraph_url', function ( $url ) {
	$slug = rb_categoria_corrente();
	return $slug ? rb_categoria_url( $slug ) : $url;
} );

add_action( 'wp_head', function () {
	$slug = rb_categoria_corrente();
	if ( ! $slug || defined( 'WPSEO_VERSION' ) ) {
		// Con Yoast attivo description e canonical li stampa lui, coi
		// valori corretti dei filtri qui sopra.
		return;
	}
	printf(
		"<meta name=\"description\" content=\"%s\" />\n<link rel=\"canonical\" href=\"%s\" />\n",
		esc_attr( rb_categoria_descrizione( $slug ) ),
		esc_url( rb_categoria_url( $slug ) )
	);
}, 4 );

/** Le voci di listino e i numeri della categoria. */
function rb_categoria_dati( $slug ) {
	$listino = rb_listino();
	$voci    = array();
	$da      = null;
	if ( is_array( $listino ) && ! empty( $listino['trattamenti'] ) ) {
		foreach ( $listino['trattamenti'] as $t ) {
			if ( ( $t['categoria'] ?? '' ) !== $slug ) {
				continue;
			}
			$voci[] = $t;
			$prezzo = $t['donna']['prezzo'] ?? null;
			if ( null !== $prezzo && ( null === $da || $prezzo < $da ) ) {
				$da = $prezzo;
			}
		}
	}
	return array( 'voci' => $voci, 'da' => $da );
}

/**
 * Due frasi vere per ogni specializzazione. Scritte, non generate a
 * caso: parlano di come lavora il centro, non di quanto è bello il mondo.
 */
function rb_categoria_intro( $slug ) {
	$testi = array(
		'laser'        => 'Epilazione laser con tecnologia recente, su pelle preparata e controllata seduta dopo seduta. Prima si fa una consulenza gratuita: fototipo, pelo, aspettative — poi si parte, con un piano chiaro di sedute e costi.',
		'waxing'       => 'La depilazione classica, fatta con cura: cere adatte alla zona e alla pelle, tempi rispettati, nessuna fretta. Prezzi chiari qui sotto, dal listino vero.',
		'body'         => 'Trattamenti corpo mirati: rimodellanti, drenanti, tonificanti. In consulenza si decide insieme cosa serve davvero — non il pacchetto più grande, quello giusto.',
		'facial'       => 'Pulizie, idratazione profonda, trattamenti specifici per età e tipo di pelle. Il viso si valuta prima di trattarlo: la consulenza è gratuita e senza impegno.',
		'massage'      => 'Massaggi rilassanti e trattamenti specifici, con il tempo che serve. La durata che leggi accanto al prezzo è tempo di trattamento, non di attesa.',
		'nails'        => 'Mani e piedi curati con prodotti professionali: manicure, pedicure, semipermanente. Prenoti su WhatsApp e trovi la postazione pronta.',
		'consultation' => 'Il primo passo, sempre: una consulenza gratuita in cui si guarda la pelle, si ascoltano gli obiettivi e si costruisce un percorso con prezzi chiari. Nessun impegno.',
		'makeup'       => 'Trucco per eventi e cerimonie, costruito sul viso e sull\'occasione. Meglio parlarne prima: scrivici e fissiamo una prova.',
		'hair'         => 'Trattamenti per i capelli con prodotti professionali. Scrivici su WhatsApp per capire insieme cosa serve ai tuoi.',
	);
	return $testi[ $slug ] ?? 'Prezzi e durate qui sotto arrivano dal listino del centro, sempre aggiornati. Per qualsiasi dubbio, la consulenza è gratuita.';
}

/**
 * Le pagine di categoria nella sitemap.
 *
 * Yoast elenca ciò che sta in bacheca: queste pagine non ci sono, e
 * infatti non comparivano in nessuna sitemap — Google poteva scoprirle
 * solo seguendo i link della home, cioè tardi e male. Qui il tema
 * pubblica la propria sitemap (/sitemap-trattamenti.xml — nome invertito
 * apposta: «<nome>-sitemap.xml» e' lo schema che Yoast si prende per se',
 * e ci saremmo pestati i piedi) e la dichiara
 * nei tre posti dove i motori la cercano: l'indice di Yoast, l'indice di
 * WordPress e il robots.txt. Con o senza plugin, le pagine si trovano.
 */

function rb_trattamenti_sitemap_url() {
	return home_url( '/sitemap-trattamenti.xml' );
}

/** Gli indirizzi delle categorie che hanno davvero voci a listino. */
function rb_trattamenti_indirizzi() {
	$listino = rb_listino();
	$slug_visti = array();
	if ( is_array( $listino ) && ! empty( $listino['trattamenti'] ) ) {
		foreach ( $listino['trattamenti'] as $t ) {
			$slug = $t['categoria'] ?? '';
			// Solo le categorie che hanno un indirizzo proprio: le altre
			// vivono come ancora dentro /servizi/ e non sono pagine.
			if ( $slug && array_search( $slug, rb_categoria_percorsi(), true ) ) {
				$slug_visti[ $slug ] = true;
			}
		}
	}
	return array_map( 'rb_categoria_url', array_keys( $slug_visti ) );
}

/* La sitemap vera e propria. Se il listino non risponde esce vuota ma
   valida: meglio una sitemap senza righe che un XML rotto, che Google
   segnalerebbe come errore per giorni. */
/* WordPress mette lo slash finale a tutto cio' che sembra una pagina:
   /trattamenti-sitemap.xml diventava /trattamenti-sitemap.xml/ con un 301,
   e la sitemap non esisteva piu'. Qui la correzione canonica si ferma. */
add_filter( 'redirect_canonical', function ( $indirizzo ) {
	return get_query_var( 'rb_sitemap' ) ? false : $indirizzo;
} );

/* Priorita' 1: prima di chiunque altro possa scrivere o rimandare altrove. */
add_action( 'template_redirect', function () {
	if ( 'trattamenti' !== get_query_var( 'rb_sitemap' ) ) {
		return;
	}
	$righe = '';
	foreach ( rb_trattamenti_indirizzi() as $url ) {
		$righe .= "\t<url>\n\t\t<loc>" . esc_url( $url ) . "</loc>\n\t\t<changefreq>weekly</changefreq>\n\t</url>\n";
	}
	status_header( 200 );
	header( 'Content-Type: application/xml; charset=UTF-8' );
	header( 'X-Robots-Tag: noindex, follow', true );
	echo '<?xml version="1.0" encoding="UTF-8"?>' . "\n";
	echo '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' . "\n" . $righe . '</urlset>';
	exit;
}, 1 );

/* Nell'indice di Yoast, che è la sitemap che il sito pubblica davvero.
   Il robots.txt qui sotto la dichiara comunque, anche senza plugin. */
add_filter( 'wpseo_sitemap_index', function ( $extra ) {
	return $extra . "<sitemap><loc>" . esc_url( rb_trattamenti_sitemap_url() ) . "</loc></sitemap>\n";
} );

add_filter( 'robots_txt', function ( $testo ) {
	if ( false !== strpos( $testo, 'sitemap-trattamenti' ) ) {
		return $testo;
	}
	return $testo . "\nSitemap: " . rb_trattamenti_sitemap_url() . "\n";
}, 20 );
