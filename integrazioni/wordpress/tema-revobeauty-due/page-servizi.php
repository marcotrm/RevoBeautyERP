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
	<p class="occhiello rivela">Listino</p>
	<h1 class="titolone rivela">Trattamenti e prezzi</h1>
	<p class="sottotitolo rivela">Quello che vedi è il listino vero del centro, aggiornato in automatico<?php if ( is_array( $listino ) && ! empty( $listino['aggiornatoIl'] ) ) : ?> — ultima lettura <?php echo esc_html( wp_date( 'j F Y, H:i', strtotime( $listino['aggiornatoIl'] ) ) ); ?><?php endif; ?>. Se un trattamento non c'è o hai un dubbio, scrivici: la consulenza è gratuita.</p>
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
	<nav class="ancore rivela" aria-label="Categorie">
		<?php foreach ( array_keys( $per_categoria ) as $slug ) : ?>
			<a href="#<?php echo esc_attr( $slug ); ?>"><?php echo esc_html( rb_nome_categoria( $slug ) ); ?></a>
		<?php endforeach; ?>
	</nav>

	<?php foreach ( $per_categoria as $slug => $voci ) : ?>
	<section class="sezione blocco-listino" id="<?php echo esc_attr( $slug ); ?>">
		<h2 class="titolo-categoria rivela"><?php echo esc_html( rb_nome_categoria( $slug ) ); ?></h2>
		<ul class="listino">
			<?php foreach ( $voci as $t ) :
				$donna = $t['donna'] ?? array();
				$uomo  = $t['uomo'] ?? array();
				$uomo_diverso = ( $uomo['prezzo'] ?? null ) !== ( $donna['prezzo'] ?? null ) || ( $uomo['durata'] ?? null ) !== ( $donna['durata'] ?? null );
				?>
				<li class="voce rivela">
					<div class="voce-testo">
						<span class="voce-nome"><?php echo esc_html( $t['nome'] ?? '' ); ?></span>
						<?php if ( $uomo_diverso ) : ?>
							<span class="voce-varianti">donna <?php echo esc_html( rb_prezzo( $donna['prezzo'] ?? null ) ); ?> · <?php echo (int) ( $donna['durata'] ?? 0 ); ?> min — uomo <?php echo esc_html( rb_prezzo( $uomo['prezzo'] ?? null ) ); ?> · <?php echo (int) ( $uomo['durata'] ?? 0 ); ?> min</span>
						<?php endif; ?>
					</div>
					<span class="voce-punti" aria-hidden="true"></span>
					<?php if ( ! $uomo_diverso ) : ?>
						<span class="voce-dati"><?php echo esc_html( rb_prezzo( $donna['prezzo'] ?? null ) ); ?> · <?php echo (int) ( $donna['durata'] ?? 0 ); ?> min</span>
					<?php endif; ?>
				</li>
			<?php endforeach; ?>
		</ul>
	</section>
	<?php endforeach; ?>

	<?php if ( ! empty( $listino['pacchetti'] ) ) : ?>
	<section class="sezione blocco-listino" id="pacchetti">
		<h2 class="titolo-categoria rivela">Pacchetti</h2>
		<div class="pacchetti">
			<?php foreach ( $listino['pacchetti'] as $p ) : ?>
				<div class="pacchetto rivela">
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
		<?php get_template_part( 'template-parts/cta-prenota' ); ?>
	</section>
<?php endif; ?>

<?php get_template_part( 'template-parts/cta-prenota' ); ?>

<?php get_footer(); ?>
