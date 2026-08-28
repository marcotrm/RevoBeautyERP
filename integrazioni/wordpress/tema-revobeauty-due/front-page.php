<?php
/**
 * La home: hero cinematico scuro, corpo luminoso, dati dal gestionale.
 */
get_header();

$listino  = rb_listino();
$whatsapp = rb_whatsapp_url();

/* Le quattro foto della striscia hero: si mettono in assets/img come
   hero-1.webp … hero-4.webp. Finché non ci sono, gradiente caldo. */
$strisce = array();
for ( $i = 1; $i <= 4; $i++ ) {
	$file = "/assets/img/hero-$i.webp";
	$strisce[] = is_readable( RB_DUE_DIR . $file ) ? RB_DUE_URI . $file : '';
}
?>

<section class="eroe">
	<div class="eroe-strisce" aria-hidden="true">
		<?php foreach ( $strisce as $i => $src ) : ?>
			<div class="eroe-striscia striscia-<?php echo (int) ( $i + 1 ); ?>"<?php if ( $src ) : ?> style="background-image:url('<?php echo esc_url( $src ); ?>')"<?php endif; ?>></div>
		<?php endforeach; ?>
	</div>
	<h1 class="eroe-logotipo">
		<span class="eroe-revo">REVO</span>
		<span class="eroe-beauty">beauty</span>
	</h1>
	<p class="eroe-riga">Estetica avanzata · Maddaloni</p>
	<div class="eroe-azioni">
		<a class="bottone bottone-oro" href="<?php echo esc_url( rb_prenota_url() ); ?>">Prenota online</a>
		<?php if ( $whatsapp ) : ?>
			<a class="bottone bottone-scuro" href="<?php echo esc_url( $whatsapp ); ?>" rel="noopener">WhatsApp</a>
		<?php endif; ?>
	</div>
</section>

<section class="sezione intro">
	<p class="occhiello rivela">Centro estetico · <?php echo esc_html( rb_centro()['indirizzo'] ?? 'Via Caudina 30, Maddaloni' ); ?></p>
	<h2 class="titolone rivela">La pelle ricorda chi se ne prende cura.</h2>
	<p class="sottotitolo rivela">Epilazione laser, trattamenti viso e corpo, unghie. Ogni percorso parte da una consulenza gratuita: pelle, obiettivi, tempi. Poi il trattamento giusto — non quello di moda.</p>
</section>

<?php if ( is_array( $listino ) && ! empty( $listino['trattamenti'] ) ) :
	// Una carta per categoria: quante voci, prezzo "da". Tutto calcolato, niente a mano.
	$categorie = array();
	foreach ( $listino['trattamenti'] as $t ) {
		$c = $t['categoria'];
		$prezzo = $t['donna']['prezzo'] ?? null;
		if ( ! isset( $categorie[ $c ] ) ) {
			$categorie[ $c ] = array( 'quante' => 0, 'da' => null );
		}
		$categorie[ $c ]['quante']++;
		if ( null !== $prezzo && $prezzo > 0 && ( null === $categorie[ $c ]['da'] || $prezzo < $categorie[ $c ]['da'] ) ) {
			$categorie[ $c ]['da'] = $prezzo;
		}
	}
	$ordinate = array();
	foreach ( rb_ordina_categorie( array_keys( $categorie ) ) as $slug ) {
		$ordinate[ $slug ] = $categorie[ $slug ];
	}
	$categorie = $ordinate;
	?>
<section class="sezione trattamenti-casa">
	<div class="riga-titolo rivela">
		<h2 class="titolone">I trattamenti</h2>
		<p class="nota-listino">prezzi e durate dal listino, sempre aggiornati</p>
	</div>
	<div class="scorri" tabindex="0" aria-label="Le categorie di trattamenti, scorri in orizzontale">
		<?php foreach ( $categorie as $slug => $info ) : ?>
			<a class="carta rivela" href="<?php echo esc_url( home_url( '/servizi/#' . $slug ) ); ?>">
				<span class="carta-occhiello"><?php echo esc_html( $info['quante'] ); ?> trattamenti</span>
				<span class="carta-nome"><?php echo esc_html( rb_nome_categoria( $slug ) ); ?></span>
				<?php if ( $info['da'] ) : ?>
					<span class="carta-prezzo">da <?php echo esc_html( rb_prezzo( $info['da'] ) ); ?></span>
				<?php else : ?>
					<span class="carta-prezzo">consulenza gratuita</span>
				<?php endif; ?>
				<span class="carta-freccia" aria-hidden="true">→</span>
			</a>
		<?php endforeach; ?>
	</div>
	<div class="scorri-barra" aria-hidden="true"><span class="scorri-indice"></span></div>
</section>
<?php else : ?>
<section class="sezione trattamenti-casa">
	<h2 class="titolone rivela">I trattamenti</h2>
	<p class="sottotitolo">Il listino completo è al telefono e su WhatsApp: scrivici e ti rispondiamo subito.</p>
</section>
<?php endif; ?>

<section class="fascia-bordeaux">
	<p class="occhiello occhiello-chiaro rivela">Dicono di noi</p>
	<blockquote class="citazione rivela">
		<p>«<?php echo esc_html( get_option( 'rb_recensione_testo', 'Ambiente curato e personale preparato: mi sono sentita seguita dal primo giorno.' ) ); ?>»</p>
		<cite><?php echo esc_html( get_option( 'rb_recensione_autrice', 'Dalle recensioni Google' ) ); ?></cite>
	</blockquote>
</section>

<?php $staff = rb_staff(); ?>
<?php if ( $staff ) : ?>
<section class="sezione squadra-casa">
	<h2 class="titolone rivela">Chi ti accoglie</h2>
	<div class="squadra-fila">
		<?php foreach ( array_slice( $staff, 0, 4 ) as $persona ) : ?>
			<div class="persona rivela">
				<?php if ( ! empty( $persona['avatar'] ) ) : ?>
					<img class="persona-foto" src="<?php echo esc_url( $persona['avatar'] ); ?>" alt="<?php echo esc_attr( $persona['nomeBreve'] ); ?>" width="120" height="120" loading="lazy" />
				<?php else : ?>
					<span class="persona-foto persona-foto-vuota" aria-hidden="true"><?php echo esc_html( mb_substr( $persona['nomeBreve'], 0, 1 ) ); ?></span>
				<?php endif; ?>
				<span class="persona-nome"><?php echo esc_html( $persona['nomeBreve'] ); ?></span>
			</div>
		<?php endforeach; ?>
	</div>
	<p class="rivela"><a class="collega" href="<?php echo esc_url( home_url( '/chi-siamo/' ) ); ?>">Conosci il team →</a></p>
</section>
<?php endif; ?>

<?php get_template_part( 'template-parts/cta-prenota' ); ?>

<?php get_footer(); ?>
