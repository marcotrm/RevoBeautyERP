<?php
/**
 * La home: hero cinematico scuro, corpo luminoso, dati dal gestionale.
 */
get_header();

$listino  = rb_listino();
$whatsapp = rb_whatsapp_url();

/* L'eroe fotografico: la vetrina vera al tramonto (assets/img/hero-full-*).
   Se le foto non ci sono, si ripiega sul logotipo gigante con le strisce. */
$foto_eroe = is_readable( RB_DUE_DIR . '/assets/img/hero-full-1400.webp' );

$strisce = array();
for ( $i = 1; $i <= 4; $i++ ) {
	$file = "/assets/img/hero-$i.webp";
	$strisce[] = is_readable( RB_DUE_DIR . $file ) ? RB_DUE_URI . $file : '';
}
?>

<?php if ( $foto_eroe ) : ?>
<?php /*
	Il logotipo gigante: fisso sul viewport, in mezzo all'eroe, in
	mix-blend-mode difference così si inverte pixel per pixel sulla foto.
	Scorrendo vola nello slot del marchio in testata (il volo è in CSS su
	timeline di scorrimento; il JS fa solo le misure — vedi motion.js).
	Dove le timeline non esistono resta un titolo dentro l'eroe e la
	testata mostra il marchio normale: nessun buco, solo meno teatro.
*/ ?>
<section class="eroe eroe-cinema" data-tono="scuro">
	<div class="eroe-media">
		<div class="eroe-fotogramma fotogramma-1">
			<picture class="eroe-sfondo">
				<source type="image/avif" sizes="100vw" srcset="<?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/hero-full-800.avif 800w, <?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/hero-full-1400.avif 1400w, <?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/hero-full-2000.avif 2000w" />
				<source type="image/webp" sizes="100vw" srcset="<?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/hero-full-800.webp 800w, <?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/hero-full-1400.webp 1400w, <?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/hero-full-2000.webp 2000w" />
				<img src="<?php echo esc_url( RB_DUE_URI . '/assets/img/hero-full-1400.webp' ); ?>" alt="L'ingresso illuminato di RevoBeauty in via Caudina a Maddaloni, all'imbrunire" width="2000" height="1107" fetchpriority="high" />
			</picture>
		</div>
		</div>
	<div class="eroe-velo" aria-hidden="true"></div>

	<div class="logotipo-volo" id="rb-volo" aria-hidden="true">
		<span class="volo-parola"><span class="volo-revo">REVO</span><span class="volo-beauty">BEAUTY</span></span>
	</div>

	<div class="eroe-piede">
		<h1 class="eroe-firma-riga">Il centro di estetica avanzata <em>a Maddaloni.</em></h1>
		<div class="eroe-azioni">
			<?php if ( $whatsapp ) : ?>
				<a class="bottone bottone-oro" href="<?php echo esc_url( $whatsapp ); ?>" rel="noopener">Prenota su WhatsApp</a>
			<?php endif; ?>
		</div>
		<a class="eroe-scorri" href="#contenuto-vero"><i aria-hidden="true"></i>Scorri</a>
	</div>
</section>
<?php else : ?>
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
		<?php if ( $whatsapp ) : ?>
			<a class="bottone bottone-oro" href="<?php echo esc_url( $whatsapp ); ?>" rel="noopener">Prenota su WhatsApp</a>
		<?php endif; ?>
	</div>
</section>
<?php endif; ?>

<section class="sezione intro" id="contenuto-vero" data-tono="chiaro">
	<p class="occhiello sale">Centro estetico · <?php echo esc_html( rb_centro()['indirizzo'] ?? 'Via Caudina 30, Maddaloni' ); ?></p>
	<h2 class="titolone inchiostro"><?php echo rb_parole( 'La pelle ricorda chi se ne prende cura.' ); // phpcs:ignore ?></h2>
	<p class="sottotitolo sale">Epilazione laser, trattamenti viso e corpo, unghie. Ogni percorso parte da una consulenza gratuita: pelle, obiettivi, tempi. Poi il trattamento giusto — non quello di moda.</p>
</section>

<?php
/*
 * I numeri che contano da zero mentre entrano in campo — ma solo numeri
 * VERI, contati adesso dal listino live. Un contatore che sale su un
 * numero inventato è il modo più rapido di bruciare la fiducia che
 * questa fascia esiste per costruire.
 */
$conta_trattamenti = is_array( $listino ) && ! empty( $listino['trattamenti'] ) ? count( $listino['trattamenti'] ) : 0;
$conta_categorie   = is_array( $listino ) && ! empty( $listino['categorie'] ) ? count( $listino['categorie'] ) : 0;
?>
<?php if ( $conta_trattamenti ) : ?>
<section class="sezione numeri" aria-label="RevoBeauty in numeri">
	<div class="numeri-fila">
		<div class="numero sale">
			<span class="numero-cifra conta" style="--fine:<?php echo (int) $conta_trattamenti; ?>"><span class="conta-vero"><?php echo (int) $conta_trattamenti; ?></span><span class="conta-anim" aria-hidden="true"></span></span>
			<span class="numero-voce">trattamenti a listino</span>
		</div>
		<div class="numero sale">
			<span class="numero-cifra conta" style="--fine:<?php echo (int) $conta_categorie; ?>"><span class="conta-vero"><?php echo (int) $conta_categorie; ?></span><span class="conta-anim" aria-hidden="true"></span></span>
			<span class="numero-voce">specializzazioni</span>
		</div>
		<div class="numero sale">
			<span class="numero-cifra">0&thinsp;&euro;</span>
			<span class="numero-voce">la prima consulenza</span>
		</div>
	</div>
</section>
<?php endif; ?>

<?php if ( is_array( $listino ) && ! empty( $listino['trattamenti'] ) ) :
	// Una carta per categoria: quante voci, prezzo "da". Tutto calcolato, niente a mano.
	$categorie = array();
	foreach ( $listino['trattamenti'] as $t ) {
		$c = $t['categoria'] ?? null;
		if ( ! $c ) {
			continue;
		}
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
	<div class="riga-titolo sale">
		<h2 class="titolone">I trattamenti</h2>
		<p class="nota-listino">prezzi e durate dal listino, sempre aggiornati</p>
	</div>
	<div class="scorri" tabindex="0" aria-label="Le categorie di trattamenti, scorri in orizzontale">
		<?php foreach ( $categorie as $slug => $info ) : ?>
			<a class="carta sale" href="<?php echo esc_url( rb_categoria_url( $slug ) ); ?>">
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

<?php
/*
 * Le righe editoriali: l'immagine al servizio del contenuto, mai da sola.
 * Tre specializzazioni di punta, alternate destra/sinistra come in una
 * rivista: la foto si scopre col sipario, il testo sale, i prezzi sono
 * quelli veri del listino. È il modo professionale di usare le immagini —
 * una texture buttata fra due sezioni non lo era.
 */
$editoriali = array( 'laser', 'facial', 'body' );
?>
<section class="sezione editoriale-blocco" aria-label="Le specializzazioni di punta">
	<?php foreach ( $editoriali as $slug ) :
		if ( ! isset( $categorie[ $slug ] ) || ! is_readable( RB_DUE_DIR . '/assets/img/categoria-' . $slug . '.webp' ) ) {
			continue;
		}
		$info = $categorie[ $slug ];
		$base = RB_DUE_URI . '/assets/img/categoria-' . $slug;
		?>
	<article class="editoriale">
		<div class="editoriale-foto quadro">
			<picture>
				<source type="image/avif" sizes="(max-width: 860px) 100vw, 50vw" srcset="<?php echo esc_attr( $base ); ?>-800.avif 800w, <?php echo esc_attr( $base ); ?>.avif 1024w" />
				<img src="<?php echo esc_url( $base . '.webp' ); ?>" srcset="<?php echo esc_attr( $base ); ?>-800.webp 800w, <?php echo esc_attr( $base ); ?>.webp 1024w" sizes="(max-width: 860px) 100vw, 50vw" alt="" width="1024" height="559" loading="lazy" decoding="async" />
			</picture>
		</div>
		<div class="editoriale-testo">
			<p class="occhiello sale"><?php echo esc_html( $info['quante'] ); ?> trattamenti<?php if ( $info['da'] ) : ?> · da <?php echo esc_html( rb_prezzo( $info['da'] ) ); ?><?php endif; ?></p>
			<h3 class="editoriale-titolo sale"><?php echo esc_html( rb_nome_categoria( $slug ) ); ?></h3>
			<p class="editoriale-frase sale"><?php echo esc_html( rb_categoria_intro( $slug ) ); ?></p>
			<a class="collega sale" href="<?php echo esc_url( rb_categoria_url( $slug ) ); ?>">Scopri e vedi i prezzi →</a>
		</div>
	</article>
	<?php endforeach; ?>
</section>
<?php else : ?>
<section class="sezione trattamenti-casa">
	<h2 class="titolone sale">I trattamenti</h2>
	<p class="sottotitolo">Il listino completo è al telefono e su WhatsApp: scrivici e ti rispondiamo subito.</p>
</section>
<?php endif; ?>



<section class="fascia-bordeaux fascia-seta-sfondo" data-tono="scuro">
	<?php /* La seta scorre più lenta sotto un velo bordeaux: la texture fa
		da fondo alle parole, non da riempitivo fra due sezioni. */ ?>
	<div class="fascia-seta deriva deriva-forte" aria-hidden="true">
		<picture>
			<source type="image/avif" sizes="100vw" srcset="<?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/materia-seta-800.avif 800w, <?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/materia-seta.avif 1024w" />
			<img src="<?php echo esc_url( RB_DUE_URI . '/assets/img/materia-seta.webp' ); ?>" srcset="<?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/materia-seta-800.webp 800w, <?php echo esc_attr( RB_DUE_URI ); ?>/assets/img/materia-seta.webp 1024w" sizes="100vw" alt="" loading="lazy" decoding="async" />
		</picture>
	</div>
	<div class="fascia-due">
		<div>
			<p class="occhiello occhiello-chiaro sale">Dicono di noi</p>
			<blockquote class="citazione sale">
				<p>«<?php echo esc_html( get_option( 'rb_recensione_testo', 'Ambiente curato e personale preparato: mi sono sentita seguita dal primo giorno.' ) ); ?>»</p>
				<cite><?php echo esc_html( get_option( 'rb_recensione_autrice', 'Dalle recensioni Google' ) ); ?></cite>
			</blockquote>
		</div>
		<div class="fascia-lato sale">
			<?php
			/* La valutazione vera della scheda Google, quando il gestionale
			   la conosce (arriva dal monitoraggio recensioni via /api/listino).
			   Numeri letti da Google, mai scritti a mano: se non ci sono
			   ancora, questa riga semplicemente non esiste. */
			$g = rb_centro()['recensioni'] ?? null;
			if ( is_array( $g ) && ! empty( $g['totale'] ) ) : ?>
				<p class="fascia-voto"><span class="fascia-voto-numero"><?php echo esc_html( number_format_i18n( (float) $g['media'], 1 ) ); ?></span> su 5 <span class="fascia-voto-stelle" aria-hidden="true">★★★★★</span></p>
				<p class="fascia-voto-conto"><?php echo (int) $g['totale']; ?> recensioni su Google</p>
			<?php endif; ?>
			<p class="fascia-lato-testo">Le recensioni sono sulla nostra scheda Google: leggile prima di scriverci, è giusto così.</p>
			<a class="collega collega-chiaro" href="<?php echo esc_url( 'https://www.google.com/maps/search/?api=1&query=' . rawurlencode( 'RevoBeauty ' . ( rb_centro()['indirizzo'] ?? 'Maddaloni' ) ) ); ?>" rel="noopener">Leggi le recensioni →</a>
		</div>
	</div>
</section>

<?php $staff = rb_staff(); ?>
<?php if ( $staff ) : ?>
<section class="sezione squadra-casa">
	<h2 class="titolone sale">Chi ti accoglie</h2>
	<div class="squadra-fila">
		<?php foreach ( array_slice( $staff, 0, 4 ) as $persona ) : ?>
			<div class="persona sale">
				<?php if ( ! empty( $persona['avatar'] ) ) : ?>
					<img class="persona-foto" src="<?php echo esc_url( $persona['avatar'] ); ?>" alt="<?php echo esc_attr( $persona['nomeBreve'] ?? '' ); ?>" width="120" height="120" loading="lazy" />
				<?php else : ?>
					<span class="persona-foto persona-foto-vuota" aria-hidden="true"><?php echo esc_html( mb_substr( (string) ( $persona['nomeBreve'] ?? '?' ), 0, 1 ) ); ?></span>
				<?php endif; ?>
				<span class="persona-nome"><?php echo esc_html( $persona['nomeBreve'] ?? '' ); ?></span>
			</div>
		<?php endforeach; ?>
	</div>
	<p class="sale"><a class="collega" href="<?php echo esc_url( home_url( '/chi-siamo/' ) ); ?>">Conosci chi ti accoglie →</a></p>
</section>
<?php endif; ?>

<?php get_footer(); ?>
