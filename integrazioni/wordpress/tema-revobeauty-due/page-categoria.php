<?php
/**
 * La pagina di una specializzazione: /trattamenti/epilazione-laser/…
 *
 * Una pagina sola, un argomento solo: il nome grande, due frasi vere,
 * i prezzi dal listino e un modo per scrivere. Chi arriva da un'inserzione
 * o da una ricerca trova esattamente ciò che cercava, senza dover
 * scavare nel listino completo.
 */

$slug   = rb_categoria_corrente();
$nome   = rb_nome_categoria( $slug );
$dati   = rb_categoria_dati( $slug );
$voci   = $dati['voci'];
$da     = $dati['da'];
$whatsapp = rb_whatsapp_url( $nome );

get_header();
?>

<section class="sezione testata-pagina testata-categoria">
	<p class="occhiello sale">Trattamenti · <?php echo count( $voci ); ?> voci<?php if ( null !== $da ) : ?> · da <?php echo esc_html( rb_prezzo( $da ) ); ?><?php endif; ?></p>
	<h1 class="titolone titolone-categoria sale"><?php echo esc_html( $nome ); ?></h1>
	<p class="sottotitolo sale"><?php echo esc_html( rb_categoria_intro( $slug ) ); ?></p>
	<div class="categoria-azioni sale">
		<?php if ( $whatsapp ) : ?>
			<a class="bottone bottone-oro" href="<?php echo esc_url( $whatsapp ); ?>" rel="noopener">Chiedi di <?php echo esc_html( mb_strtolower( $nome ) ); ?></a>
		<?php endif; ?>
		<a class="collega" href="<?php echo esc_url( home_url( '/servizi/' ) ); ?>">Tutti i trattamenti →</a>
	</div>
</section>

<?php
/* La foto della specializzazione, se c'è: assets/img/categoria-<slug>.webp.
   Il meccanismo è per nome di file: quando arriverà una foto nuova basta
   metterla lì, senza toccare una riga. */
$foto_cat = 'categoria-' . $slug;
if ( is_readable( RB_DUE_DIR . '/assets/img/' . $foto_cat . '.webp' ) ) : ?>
<section class="foto-categoria quadro quadro-16x9">
	<picture>
		<source type="image/avif" sizes="100vw" srcset="<?php echo esc_attr( RB_DUE_URI . '/assets/img/' . $foto_cat ); ?>-800.avif 800w, <?php echo esc_attr( RB_DUE_URI . '/assets/img/' . $foto_cat ); ?>.avif 1024w" />
		<img src="<?php echo esc_url( RB_DUE_URI . '/assets/img/' . $foto_cat . '.webp' ); ?>" srcset="<?php echo esc_attr( RB_DUE_URI . '/assets/img/' . $foto_cat ); ?>-800.webp 800w, <?php echo esc_attr( RB_DUE_URI . '/assets/img/' . $foto_cat ); ?>.webp 1024w" sizes="100vw" alt="" width="1024" height="572" loading="lazy" decoding="async" />
	</picture>
</section>
<?php endif; ?>

<?php if ( $voci ) : ?>
<section class="sezione blocco-listino">
	<header class="categoria-testa sale">
		<span class="categoria-indice" aria-hidden="true"><?php echo count( $voci ); ?></span>
		<h2 class="titolo-categoria">Prezzi e durate</h2>
		<span class="categoria-conto">dal listino, sempre aggiornati</span>
	</header>
	<ul class="listino">
		<?php foreach ( $voci as $t ) :
			$donna = $t['donna'] ?? array();
			$uomo  = $t['uomo'] ?? array();
			$uomo_diverso = ( $uomo['prezzo'] ?? null ) !== ( $donna['prezzo'] ?? null ) || ( $uomo['durata'] ?? null ) !== ( $donna['durata'] ?? null );
			?>
			<li class="voce sale">
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
<?php else : ?>
<section class="sezione">
	<p class="sottotitolo sale">Il listino di questa categoria è al telefono e su WhatsApp: scrivici e ti rispondiamo subito.</p>
</section>
<?php endif; ?>

<section class="fascia-bordeaux">
	<p class="occhiello occhiello-chiaro sale">Come funziona</p>
	<div class="passi-fila sale">
		<p class="passo-breve"><strong>1 · Ci scrivi.</strong> Su WhatsApp, anche solo per un prezzo.</p>
		<p class="passo-breve"><strong>2 · Consulenza gratuita.</strong> Si guarda, si ascolta, si decide insieme.</p>
		<p class="passo-breve"><strong>3 · Decidi tu.</strong> Nessun impegno, nessuna caparra.</p>
	</div>
</section>

<?php get_footer(); ?>
