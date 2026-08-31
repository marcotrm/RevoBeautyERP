<?php
/**
 * /servizi — il listino vero, dal gestionale.
 *
 * Ogni voce mostra prezzo e durata donna e, quando diversi, uomo.
 * Qui non si scrive un prezzo: si stampa quello che dice il gestionale.
 */
get_header();

$listino = rb_listino();
?>

<section class="sezione testata-pagina">
	<p class="occhiello sale">Listino</p>
	<h1 class="titolone sale">Trattamenti e prezzi</h1>
	<p class="sottotitolo sale">Prezzi e durate arrivano dal gestionale del centro: quello che leggi qui è quello che paghi in cassa. Se un trattamento non c'è o hai un dubbio, scrivici — la consulenza è gratuita.</p>
</section>

<?php if ( is_array( $listino ) && ! empty( $listino['trattamenti'] ) ) :
	$per_categoria = array();
	foreach ( $listino['trattamenti'] as $t ) {
		if ( empty( $t['categoria'] ) ) {
			continue;
		}
		$per_categoria[ $t['categoria'] ][] = $t;
	}
	$ordinate = array();
	foreach ( rb_ordina_categorie( array_keys( $per_categoria ) ) as $slug ) {
		$ordinate[ $slug ] = $per_categoria[ $slug ];
	}
	$per_categoria = $ordinate;
	?>
	<?php /*
		Il listino ha 112 voci: tutte in fila fanno sedici schermate di telefono,
		e nessuno arriva in fondo. Quindi si sceglie prima la categoria e si
		legge solo quella — con la ricerca per chi sa già il nome.

		Quello che NON si nasconde mai è prezzo e durata: sono le due cose per
		cui si apre questa pagina, e metterle dietro un tocco vorrebbe dire far
		lavorare la cliente per un dato che le spetta. Si nasconde la categoria
		intera, non il dettaglio della voce.

		Senza JavaScript i filtri spariscono e resta l'elenco completo: lungo,
		ma tutto lì e tutto leggibile.
	*/ ?>
	<div class="filtri" data-filtri>
		<div class="cerca-riga">
			<label class="cerca-etichetta" for="cerca-trattamento">Cerca un trattamento</label>
			<input type="search" id="cerca-trattamento" data-cerca placeholder="es. laser ascelle, pressoterapia&hellip;" autocomplete="off" />
		</div>
		<nav class="pastiglie" aria-label="Categorie">
			<?php $prima = true; foreach ( $per_categoria as $slug => $voci ) : ?>
				<button type="button" class="pastiglia" data-cat="<?php echo esc_attr( $slug ); ?>"<?php echo $prima ? ' aria-pressed="true"' : ' aria-pressed="false"'; ?>>
					<?php echo esc_html( rb_nome_categoria( $slug ) ); ?>
					<span class="pastiglia-conto"><?php echo count( $voci ); ?></span>
				</button>
			<?php $prima = false; endforeach; ?>
			<?php if ( ! empty( $listino['pacchetti'] ) ) : ?>
				<button type="button" class="pastiglia" data-cat="pacchetti" aria-pressed="false">
					Pacchetti
					<span class="pastiglia-conto"><?php echo count( $listino['pacchetti'] ); ?></span>
				</button>
			<?php endif; ?>
		</nav>
	</div>

	<?php $indice = 0; foreach ( $per_categoria as $slug => $voci ) : $indice++; ?>
	<section class="sezione blocco-listino" id="<?php echo esc_attr( $slug ); ?>" data-blocco="<?php echo esc_attr( $slug ); ?>">
		<?php /* La testa di categoria è una colonna che resta ferma mentre le
			voci scorrono: numero grande, nome, conteggio. Sul telefono torna
			una testata normale sopra l'elenco. */ ?>
		<header class="categoria-testa sale">
			<span class="categoria-indice" aria-hidden="true"><?php printf( '%02d', $indice ); ?></span>
			<h2 class="titolo-categoria"><?php echo esc_html( rb_nome_categoria( $slug ) ); ?></h2>
			<span class="categoria-conto"><?php echo count( $voci ); ?> trattamenti</span>
		</header>
		<ul class="listino">
			<?php foreach ( $voci as $t ) :
				$donna = $t['donna'] ?? array();
				$uomo  = $t['uomo'] ?? array();
				$uomo_diverso = ( $uomo['prezzo'] ?? null ) !== ( $donna['prezzo'] ?? null ) || ( $uomo['durata'] ?? null ) !== ( $donna['durata'] ?? null );
				?>
				<?php /*
					Prezzo e durata stanno SEMPRE sulla stessa riga del nome, a destra:
					sono le due cose per cui si apre questa pagina, e mandarle a capo
					raddoppia l'altezza di ogni voce — su quarantatré voci sono cinque
					schermate di telefono in più. Quando il prezzo uomo è diverso va
					sotto, in piccolo, che è l'eccezione e non la regola.
				*/ ?>
				<li class="voce sale" data-nome="<?php echo esc_attr( mb_strtolower( $t['nome'] ?? '' ) ); ?>">
					<div class="voce-riga">
						<span class="voce-nome"><?php echo esc_html( rb_nome_corto( $t['nome'] ?? '', $slug ) ); ?></span>
						<span class="voce-punti" aria-hidden="true"></span>
						<span class="voce-dati"><?php echo esc_html( rb_prezzo( $donna['prezzo'] ?? null ) ); ?> · <?php echo (int) ( $donna['durata'] ?? 0 ); ?>&thinsp;min</span>
					</div>
					<?php if ( $uomo_diverso ) : ?>
						<span class="voce-varianti">uomo <?php echo esc_html( rb_prezzo( $uomo['prezzo'] ?? null ) ); ?> · <?php echo (int) ( $uomo['durata'] ?? 0 ); ?>&thinsp;min</span>
					<?php endif; ?>
				</li>
			<?php endforeach; ?>
		</ul>
	</section>
	<?php endforeach; ?>

	<?php if ( ! empty( $listino['pacchetti'] ) ) : ?>
	<section class="sezione blocco-listino" id="pacchetti" data-blocco="pacchetti">
		<header class="categoria-testa sale">
			<span class="categoria-indice" aria-hidden="true"><?php printf( '%02d', $indice + 1 ); ?></span>
			<h2 class="titolo-categoria">Pacchetti</h2>
			<span class="categoria-conto"><?php echo count( $listino['pacchetti'] ); ?> pacchetti</span>
		</header>
		<div class="pacchetti">
			<?php foreach ( $listino['pacchetti'] as $p ) : ?>
				<div class="pacchetto voce sale" data-nome="<?php echo esc_attr( mb_strtolower( ( $p['nome'] ?? '' ) . ' ' . ( $p['trattamento'] ?? '' ) ) ); ?>">
					<span class="pacchetto-nome"><?php echo esc_html( $p['nome'] ?? '' ); ?></span>
					<span class="pacchetto-dettagli"><?php echo (int) ( $p['sedute'] ?? 0 ); ?> sedute<?php if ( ! empty( $p['trattamento'] ) ) : ?> · <?php echo esc_html( $p['trattamento'] ); ?><?php endif; ?></span>
					<span class="pacchetto-prezzo"><?php echo esc_html( rb_prezzo( $p['prezzo'] ?? null ) ); ?></span>
				</div>
			<?php endforeach; ?>
		</div>
	</section>
	<?php endif; ?>

<?php else : ?>
	<section class="sezione">
		<p class="sottotitolo">In questo momento non riusciamo a mostrarti il listino. Chiamaci o scrivici su WhatsApp: ti rispondiamo subito.</p>
			</section>
<?php endif; ?>

<?php get_footer(); ?>
